"use server";
import { requireStaff } from "@/lib/staff";
import { randomBytes } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { notifyStatus } from "@/lib/notify";
import { logEvent, setTask, type TaskKind } from "@/lib/missions";

const TASK_FOR: Record<string, TaskKind> = { hold: "price_hold", visa: "visa", forex: "forex", insurance: "insurance", flight: "flights", hotel: "hotels" };
const TEAM_NOTE: Record<string, string> = { contacted: "Our team is working on it.", booked: "Confirmed by our team.", closed: "Closed by our team." };

/** Mirrors a team status change onto the traveller's trip hub. */
async function syncMissionFromEnquiry(id: string, status: string) {
  const e = await prisma.enquiry.findUnique({ where: { id }, select: { missionId: true, type: true, ref: true } });
  const kind = e?.missionId ? TASK_FOR[e.type] : undefined;
  if (!e?.missionId || !kind || !TEAM_NOTE[status]) return;
  await setTask(e.missionId, kind, { status: status === "booked" ? "done" : status === "closed" ? "skipped" : "waiting", note: `${TEAM_NOTE[status]} Ref ${e.ref}.` });
  await logEvent(e.missionId, "team", `${kind.replace("_", " ")}: ${TEAM_NOTE[status]} (ref ${e.ref})`);
}
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentAdmin, endSession, passwordLoginEnabled, passwordMatches, requireAdmin, startSession } from "@/lib/auth";
import { sendLoginCode, verifyLoginCode } from "@/lib/otp";
import { BOARDS, KINDS, isoDate } from "@/lib/pricing";
import { setEnquiryStatus } from "@/lib/bookings";
import { uploadPhoto } from "@/lib/supabase";
import { buildSchedule } from "@/lib/schedule";
import { TRIPS_TAG } from "@/lib/trips";
import { refreshEasyVisaFlags } from "@/lib/visa-data";

/** Clear cached trip data so the public site shows changes immediately. */
function refreshSite() {
  revalidateTag(TRIPS_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}

/* ---------- auth ---------- */
export async function login(_: { error?: string } | undefined, fd: FormData) {
  const pw = String(fd.get("password") ?? "");
  // small delay makes guessing slower
  await new Promise((r) => setTimeout(r, 400));
  if (!passwordLoginEnabled() || !passwordMatches(pw)) return { error: "Wrong password." };
  await startSession("password");
  redirect("/admin");
}

/* Email-code sign-in for addresses listed in ADMIN_EMAILS. The answer is the
   same whether or not an address is allowed, so the list can't be guessed. */
export async function requestAdminCode(rawEmail: string) {
  const email = String(rawEmail).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  const { isStaffEmail } = await import("@/lib/staff");
  if (!(await isStaffEmail(email))) {
    await new Promise((r) => setTimeout(r, 600));
    return { ok: true };
  }
  return sendLoginCode(email, "admin");
}

export async function verifyAdminCode(rawEmail: string, code: string) {
  const email = String(rawEmail).trim().toLowerCase();
  const { isStaffEmail } = await import("@/lib/staff");
  if (!(await isStaffEmail(email))) return { ok: false, error: "That code isn't right." };
  const r = await verifyLoginCode(email, "admin", String(code).trim());
  if (!r.ok) return r;
  await startSession(email);
  return { ok: true, redirect: "/admin" };
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

/* ---------- enquiries ---------- */
const STATUSES = ["new", "contacted", "booked", "closed"];

export async function updateEnquiry(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  const note = String(fd.get("note") ?? "").slice(0, 2000);
  if (!STATUSES.includes(status)) return;
  // the price the customer can pay online (custom trips and services the team has priced)
  const rawTotal = String(fd.get("total") ?? "").replace(/[^\d]/g, "");
  if (rawTotal) {
    const total = Number(rawTotal);
    const paid = await prisma.payment.count({ where: { enquiryId: id, status: { not: "created" } } });
    const prev = await prisma.enquiry.findUnique({ where: { id }, select: { quotedTotal: true, missionId: true, email: true, ref: true } });
    if (prev && total > 0 && total < 10_000_000 && !paid && total !== prev.quotedTotal) {
      await prisma.enquiry.update({ where: { id }, data: { quotedTotal: total } });
      // tell the traveller it's ready to pay: in their trip timeline and as a push
      const { payUrl } = await import("@/lib/payments");
      const { fmt } = await import("@/lib/pricing");
      if (prev.missionId) await logEvent(prev.missionId, "team", `Your price is ready: ${fmt(total)} (ref ${prev.ref}). Pay securely online whenever you're ready.`);
      const { pushToEmail } = await import("@/lib/push");
      after(() => pushToEmail(prev.email, { title: "Your price is ready", body: `${fmt(total)} for ${prev.ref}. Tap to pay securely online.`, url: payUrl(prev.ref), tag: `price-${prev.ref}`, important: true }).then(() => undefined));
    }
  }
  const before = await prisma.enquiry.findUnique({ where: { id }, select: { status: true } });
  await setEnquiryStatus(id, status, note || null);
  await syncMissionFromEnquiry(id, status);
  if (before && before.status !== status && fd.get("notify") === "on") after(() => notifyStatus(id));
  refreshSite();
}

export async function deleteEnquiry(fd: FormData) {
  await requireStaff("deleteRecords");
  const id = String(fd.get("id"));
  // payment records are financial records: a request with real payments can be closed, not deleted
  if (await prisma.payment.count({ where: { enquiryId: id, status: { not: "created" } } })) return;
  await prisma.payment.deleteMany({ where: { enquiryId: id } });
  await prisma.enquiry.delete({ where: { id } });
  revalidatePath("/admin", "layout");
}

/* ---------- trips ---------- */
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

const IMG_TYPES: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

async function saveUpload(file: File) {
  const ext = IMG_TYPES[file.type];
  if (!ext) throw new Error("Upload a JPG, PNG or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB.");
  const name = `${new Date().toISOString().slice(0, 7)}/${randomBytes(8).toString("hex")}${ext}`;
  return uploadPhoto(name, Buffer.from(await file.arrayBuffer()), file.type);
}

export type TripFormState = { error?: string } | undefined;

export async function saveTrip(_: TripFormState, fd: FormData): Promise<TripFormState> {
  await requireStaff("catalogue");
  const id = String(fd.get("id") ?? "");
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  const n = (k: string) => Number(s(k));
  const b = (k: string) => fd.get(k) === "on";
  const optInt = (k: string) => (s(k) === "" ? null : Math.round(n(k)));

  const title = s("title");
  if (title.length < 4) return { error: "Title must be at least 4 characters." };
  if (!s("dest") || !s("country") || !s("region")) return { error: "Destination, country and region are required." };
  if (!(s("kind") in KINDS)) return { error: "Choose a trip type." };
  if (!(s("board") in BOARDS)) return { error: "Choose a meal plan." };
  if (!(n("nights") >= 1 && n("nights") <= 60)) return { error: "Nights must be between 1 and 60." };
  if (!(n("price") > 0)) return { error: "Price must be more than 0." };
  if (!s("highlights") || !s("days")) return { error: "Add at least one highlight and one itinerary day." };

  let image = s("image");
  const file = fd.get("upload");
  if (file instanceof File && file.size > 0) {
    try { image = await saveUpload(file); } catch (e) { return { error: (e as Error).message }; }
  }
  if (!image) return { error: "Choose a photo or upload one." };

  const themes = fd.getAll("themes").map(String).join(",");
  const data = {
    title, dest: s("dest"), country: s("country"), region: s("region"), kind: s("kind"), themes,
    nights: Math.round(n("nights")), stars: Math.min(5, Math.max(1, Math.round(n("stars")) || 4)), board: s("board"),
    price: Math.round(n("price")), was: optInt("was"), rating: Math.min(10, Math.max(0, n("rating") || 9)), reviews: Math.max(0, Math.round(n("reviews")) || 0),
    beach: optInt("beach"),
    flight: b("flight"), freeCancel: b("freeCancel"), tourManager: b("tourManager"),
    lastMinute: b("lastMinute"), earlyBird: b("earlyBird"), featured: b("featured"), published: b("published"),
    image, highlights: s("highlights"), days: s("days"),
    countryCodes: [...new Set(s("countryCodes").toUpperCase().split(",").map((c) => c.trim()).filter((c) => /^[A-Z]{2}$/.test(c)))].join(","),
    visaNote: s("visaNote") || null,
  };

  let slug = slugify(s("slug") || `${data.dest}-${title}-${data.nights}n`);
  const clash = await prisma.trip.findFirst({ where: { slug, NOT: id ? { id } : undefined } });
  if (clash) slug = `${slug}-${randomBytes(2).toString("hex")}`;

  let tripId = id;
  if (id) await prisma.trip.update({ where: { id }, data: { ...data, slug } });
  else {
    const t = await prisma.trip.create({ data: { ...data, slug } });
    tripId = t.id;
    // new trips get six months of dates straight away; edit them on the trip page
    const plan = buildSchedule({ tripId: t.slug, kind: t.kind, base: t.price, start: isoDate(new Date()), days: 180, lastMinute: t.lastMinute });
    await prisma.departure.createMany({ data: plan.map((p) => ({ ...p, tripId: t.id })) });
  }

  await refreshEasyVisaFlags(); // recompute the trip's "easy visa" flag from its countries
  refreshSite();
  redirect(id ? "/admin/trips?saved=1" : `/admin/trips/${tripId}?created=1#departures`);
}

export async function deleteTrip(fd: FormData) {
  await requireStaff("catalogue");
  await prisma.trip.delete({ where: { id: String(fd.get("id")) } });
  refreshSite();
  redirect("/admin/trips?deleted=1");
}

export async function togglePublished(fd: FormData) {
  await requireStaff("catalogue");
  const id = String(fd.get("id"));
  const t = await prisma.trip.findUnique({ where: { id }, select: { published: true } });
  if (t) await prisma.trip.update({ where: { id }, data: { published: !t.published } });
  refreshSite();
}

export async function deleteSubscriber(fd: FormData) {
  await requireStaff("deleteRecords");
  await prisma.subscriber.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/admin/subscribers");
}

/* ---------- departures ---------- */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function addDeparture(fd: FormData) {
  await requireStaff("catalogue");
  const tripId = String(fd.get("tripId"));
  const date = String(fd.get("date"));
  if (!DATE_RE.test(date)) return;
  const seats = String(fd.get("seats") ?? "").trim();
  await prisma.departure.upsert({
    where: { tripId_date: { tripId, date } },
    update: { priceDelta: Math.round(Number(fd.get("delta")) || 0), seatsLeft: seats === "" ? null : Math.max(0, Math.round(Number(seats))), status: "open" },
    create: { tripId, date, priceDelta: Math.round(Number(fd.get("delta")) || 0), seatsLeft: seats === "" ? null : Math.max(0, Math.round(Number(seats))) },
  });
  refreshSite();
}

export async function updateDeparture(fd: FormData) {
  await requireStaff("catalogue");
  const id = String(fd.get("id"));
  const seats = String(fd.get("seats") ?? "").trim();
  await prisma.departure.update({
    where: { id },
    data: {
      priceDelta: Math.round(Number(fd.get("delta")) || 0),
      seatsLeft: seats === "" ? null : Math.max(0, Math.round(Number(seats))),
      status: fd.get("status") === "closed" ? "closed" : "open",
    },
  });
  refreshSite();
}

export async function deleteDeparture(fd: FormData) {
  await requireStaff("catalogue");
  await prisma.departure.delete({ where: { id: String(fd.get("id")) } });
  refreshSite();
}

/** Fill the calendar: one departure every N days for the next M months (existing dates are kept). */
export async function generateDepartures(fd: FormData) {
  await requireStaff("catalogue");
  const tripId = String(fd.get("tripId"));
  const t = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!t) return;
  const every = Math.min(60, Math.max(1, Math.round(Number(fd.get("every")) || 3)));
  const months = Math.min(18, Math.max(1, Math.round(Number(fd.get("months")) || 6)));
  const seatsRaw = String(fd.get("seats") ?? "").trim();
  const plan = buildSchedule({
    tripId: t.slug, kind: t.kind, base: t.price, start: isoDate(new Date()), days: months * 30, every,
    seats: seatsRaw === "" ? null : Math.max(1, Math.round(Number(seatsRaw))), lastMinute: t.lastMinute,
  });
  const existing = new Set((await prisma.departure.findMany({ where: { tripId }, select: { date: true } })).map((d) => d.date));
  const fresh = plan.filter((p) => !existing.has(p.date)).map((p) => ({ ...p, tripId }));
  if (fresh.length) await prisma.departure.createMany({ data: fresh });
  refreshSite();
}

/** "Run agents now" on the dashboard: same work as the daily run, on demand. */
export async function runAgentsNow() {
  await requireStaff("reports");
  const { runAgents } = await import("@/lib/agents/run");
  const h = await headers();
  await runAgents({ origin: `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}` });
  revalidatePath("/admin");
}

/* ---------- service options ---------- */
export type OfferFormState = { ok?: string; error?: string } | undefined;

export async function sendOffersAction(_: OfferFormState, fd: FormData): Promise<OfferFormState> {
  await requireAdmin();
  const { sendOffers, OfferError } = await import("@/lib/offers");
  const { notifyOffers } = await import("@/lib/notify");
  const enquiryId = String(fd.get("enquiryId"));
  const options = [0, 1, 2].map((i) => ({
    title: String(fd.get(`title${i}`) ?? "").trim(),
    lines: String(fd.get(`lines${i}`) ?? "").split("\n"),
    priceInr: Number(String(fd.get(`price${i}`) ?? "").replace(/[^\d]/g, "")) || null,
  })).filter((o) => o.title);
  try {
    const sent = await sendOffers(enquiryId, options, Number(fd.get("validHours")) || 48);
    if (fd.get("notify") === "on") after(() => notifyOffers(enquiryId));
    revalidatePath("/admin/enquiries");
    return { ok: `Sent ${sent.length} option${sent.length > 1 ? "s" : ""}. They're in the traveller's trip hub${fd.get("notify") === "on" ? " and inbox" : ""}.` };
  } catch (e) {
    if (e instanceof OfferError) return { error: e.message };
    throw e;
  }
}

export async function markBookedAction(_: OfferFormState, fd: FormData): Promise<OfferFormState> {
  await requireAdmin();
  const { markOfferBooked, OfferError } = await import("@/lib/offers");
  const { notifyBooked } = await import("@/lib/notify");
  const offerId = String(fd.get("offerId"));
  try {
    await markOfferBooked(offerId, String(fd.get("confirmation") ?? ""));
    after(() => notifyBooked(offerId));
    revalidatePath("/admin/enquiries");
    return { ok: "Booked. The traveller has been emailed the confirmation." };
  } catch (e) {
    if (e instanceof OfferError) return { error: e.message };
    throw e;
  }
}

/* ---------- team inbox (co-pilot) ---------- */
export async function draftReplyAction(enquiryId: string) {
  await requireAdmin();
  const { draftReply } = await import("@/lib/copilot");
  return draftReply(enquiryId);
}

export type MessageResult = { ok: true; message: string } | { ok: false; error: string };

export async function sendReplyAction(i: { enquiryId: string; channel: "email" | "whatsapp" | "note"; subject?: string; body: string; drafted: boolean }): Promise<MessageResult> {
  await requireAdmin();
  const author = (await currentAdmin()) ?? "admin";
  const { sendTeamEmail, logWhatsApp, addTeamNote, MessageError } = await import("@/lib/team-messages");
  try {
    if (i.channel === "email") await sendTeamEmail({ enquiryId: i.enquiryId, subject: i.subject ?? "", body: i.body, author, drafted: i.drafted });
    else if (i.channel === "whatsapp") await logWhatsApp({ enquiryId: i.enquiryId, body: i.body, author, drafted: i.drafted });
    else await addTeamNote({ enquiryId: i.enquiryId, body: i.body, author });
    revalidatePath("/admin/inbox");
    return { ok: true, message: i.channel === "email" ? "Email sent." : i.channel === "whatsapp" ? "Logged. Finish sending in WhatsApp." : "Note saved." };
  } catch (e) {
    if (e instanceof MessageError) return { ok: false, error: e.message };
    throw e;
  }
}

/* ---------- reviews ---------- */
export async function moderateReview(fd: FormData) {
  await requireStaff("catalogue");
  const status = String(fd.get("status"));
  if (!["published", "rejected", "pending"].includes(status)) return;
  const { setReviewStatus } = await import("@/lib/reviews");
  await setReviewStatus(String(fd.get("id")), status as "published" | "rejected" | "pending");
  revalidatePath("/admin/reviews");
}

/* ---------- payments ---------- */
export type RefundState = { ok?: string; error?: string } | undefined;
export async function refundAction(_: RefundState, fd: FormData): Promise<RefundState> {
  await requireStaff("money");
  const { refund, PayError, RazorpayError } = await import("@/lib/payments");
  const amount = Number(String(fd.get("amount") ?? "").replace(/[^\d]/g, ""));
  if (!(amount > 0)) return { error: "Enter an amount in rupees." };
  try {
    const r = await refund(String(fd.get("paymentId")), amount, String(fd.get("reason") ?? "Refund"));
    revalidatePath("/admin/enquiries");
    return { ok: `Refund of ₹${r.refunded.toLocaleString("en-IN")} started. It reaches the customer in 5–7 working days.` };
  } catch (e) {
    if (e instanceof PayError || e instanceof RazorpayError) return { error: e.message };
    throw e;
  }
}

/* ---------- GST invoices ---------- */

/** Issue the tax invoice now for what's been paid (normally automatic once fully paid). */
export async function issueInvoiceAction(fd: FormData) {
  await requireStaff("money");
  const { issueInvoice, emailInvoice, InvoiceError } = await import("@/lib/invoices");
  try {
    const inv = await issueInvoice(String(fd.get("id")));
    if (!inv.emailedAt && fd.get("email") === "on") await emailInvoice(inv);
  } catch (e) { if (!(e instanceof InvoiceError)) throw e; }
  revalidatePath("/admin/enquiries"); revalidatePath("/admin/invoices");
}

/** A credit note against an invoice (price reduction, cancellation charge waived…). Refunds make one automatically. */
export async function creditNoteAction(fd: FormData) {
  await requireStaff("money");
  const amount = Number(String(fd.get("amount") ?? "").replace(/[^\d.]/g, ""));
  const reason = String(fd.get("reason") ?? "").trim();
  if (!amount || !reason) return;
  const { issueCreditNote, emailInvoice, InvoiceError } = await import("@/lib/invoices");
  try { const cn = await issueCreditNote(String(fd.get("invoiceId")), amount, reason); if (fd.get("email") === "on") await emailInvoice(cn); }
  catch (e) { if (!(e instanceof InvoiceError)) throw e; }
  revalidatePath("/admin/enquiries"); revalidatePath("/admin/invoices");
}

/** Company GST details for a booking's invoice; only before the invoice is issued. */
export async function setBillingAction(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id"));
  if (await prisma.invoice.count({ where: { enquiryId: id, kind: "invoice" } })) return;
  const { checkGstin } = await import("@/lib/gst-rules");
  const raw = String(fd.get("gstin") ?? "").trim();
  const g = raw ? checkGstin(raw) : null;
  if (g && !g.ok) return;
  await prisma.enquiry.update({ where: { id }, data: { billingName: String(fd.get("name") ?? "").trim().slice(0, 120) || null, billingGstin: g?.ok ? g.gstin : null, billingAddress: String(fd.get("address") ?? "").trim().slice(0, 300) || null } });
  revalidatePath("/admin/enquiries");
}

/* ---------- seasons, bulk changes, copying ---------- */

/** Adds a season of departures: a date range, on chosen weekdays or every N days, with one price change and seat count. */
export async function addSeason(fd: FormData) {
  await requireStaff("catalogue");
  const { seasonDates } = await import("@/lib/season-rules");
  const tripId = String(fd.get("tripId"));
  const from = String(fd.get("from")), to = String(fd.get("to"));
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return;
  const weekdays = fd.getAll("wd").map(Number).filter((n) => n >= 0 && n <= 6);
  const dates = seasonDates({ from, to, weekdays, every: Number(fd.get("every")) || 7, notBefore: isoDate(new Date(Date.now() + 2 * 864e5)) });
  const seatsRaw = String(fd.get("seats") ?? "").trim();
  const data = { priceDelta: Math.round(Number(fd.get("delta")) || 0), seatsLeft: seatsRaw === "" ? null : Math.max(0, Math.round(Number(seatsRaw))), status: "open" };
  const overwrite = fd.get("overwrite") === "on";
  const existing = new Map((await prisma.departure.findMany({ where: { tripId, date: { in: dates } }, select: { id: true, date: true } })).map((d) => [d.date, d.id]));
  const fresh = dates.filter((d) => !existing.has(d)).map((date) => ({ tripId, date, ...data }));
  if (fresh.length) await prisma.departure.createMany({ data: fresh });
  if (overwrite && existing.size) await prisma.departure.updateMany({ where: { id: { in: [...existing.values()] } }, data });
  refreshSite();
}

/** One change to every departure in a date range: price, surcharge, seats, open/close or delete (dates with bookings are kept). */
export async function bulkDepartures(fd: FormData) {
  await requireStaff("catalogue");
  const { applyBulk } = await import("@/lib/season-rules");
  const tripId = String(fd.get("tripId"));
  const from = String(fd.get("from")), to = String(fd.get("to"));
  const action = String(fd.get("action")) as import("@/lib/season-rules").BulkAction;
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || !["set_delta", "add_delta", "set_seats", "close", "open", "delete"].includes(action)) return;
  const raw = String(fd.get("value") ?? "").trim();
  const value = raw === "" ? null : Number(raw);
  const weekdays = fd.getAll("wd").map(Number);
  const deps = await prisma.departure.findMany({ where: { tripId, date: { gte: from, lte: to } }, include: { _count: { select: { enquiries: true } } } });
  for (const d of deps) {
    if (weekdays.length && !weekdays.includes(new Date(d.date + "T00:00:00Z").getUTCDay())) continue;
    const r = applyBulk({ priceDelta: d.priceDelta, seatsLeft: d.seatsLeft, status: d.status, booked: d._count.enquiries > 0 }, action, value);
    if (r === "keep") continue;
    if (r === null) await prisma.departure.delete({ where: { id: d.id } });
    else await prisma.departure.update({ where: { id: d.id }, data: { priceDelta: r.priceDelta, seatsLeft: r.seatsLeft, status: r.status } });
  }
  refreshSite();
}

/** Copies a trip (details, photos, itinerary) as an unpublished draft, optionally with its future dates. */
export async function copyTrip(fd: FormData) {
  await requireStaff("catalogue");
  const t = await prisma.trip.findUnique({ where: { id: String(fd.get("id")) }, include: { departures: { where: { date: { gte: isoDate(new Date()) } } } } });
  if (!t) return;
  let slug = `${t.slug}-copy`;
  for (let i = 2; await prisma.trip.findUnique({ where: { slug } }); i++) slug = `${t.slug}-copy-${i}`;
  const { id: _id, createdAt: _c, updatedAt: _u, departures, slug: _s, ...rest } = t;
  const copy = await prisma.trip.create({
    data: {
      ...rest, slug, title: `${t.title} (copy)`, published: false, featured: false, reviews: 0,
      ...(fd.get("dates") === "on" ? { departures: { create: departures.map((d) => ({ date: d.date, priceDelta: d.priceDelta, seatsLeft: d.seatsLeft, status: d.status })) } } : {}),
    },
  });
  refreshSite();
  redirect(`/admin/trips/${copy.id}`);
}

/* ---------- visa service ---------- */

const VISA_KINDS = ["evisa", "sticker", "eta", "arrival", "visa_free"];
const DOC_KEYS = ["passport", "photo", "bank_statement", "itr", "employment_proof", "cover_letter", "insurance", "flight_booking", "hotel_booking", "other"];

/** "passport | Passport front and back | note" per line → the documents list. Unknown kinds become "other". */
function parseDocs(raw: string) {
  return raw.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((x) => x[0]).map(([k, label, note]) => ({ kind: DOC_KEYS.includes(k) ? k : "other", label: label || k, ...(note ? { note } : {}) }));
}

/** Create or update a visa in the catalogue. Ticking "verified" records that the team checked the fee and rules today. */
export async function saveVisaProduct(fd: FormData) {
  await requireStaff("catalogue");
  const id = String(fd.get("id") ?? "");
  const num = (k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? null : Math.max(0, Math.round(Number(v))); };
  const kind = String(fd.get("kind") ?? "evisa");
  const countryCode = String(fd.get("countryCode") ?? "").trim().toUpperCase();
  const name = String(fd.get("name") ?? "").trim();
  if (!/^[A-Z]{2}$/.test(countryCode) || name.length < 3 || !VISA_KINDS.includes(kind)) return;
  const { slugify } = await import("@/lib/climate-rules");
  const destSlug = slugify(String(fd.get("destSlug") ?? "") || (await import("@/lib/visa")).countryName(countryCode));
  const data = {
    countryCode, destSlug, name, kind, entries: String(fd.get("entries") ?? "single"),
    validityDays: num("validityDays"), stayDays: num("stayDays"), processingDays: num("processingDays") ?? 5,
    needsAppointment: fd.get("needsAppointment") === "on", govtFee: num("govtFee") ?? 0, serviceFee: num("serviceFee") ?? 0,
    docs: JSON.stringify(parseDocs(String(fd.get("docs") ?? ""))), notes: String(fd.get("notes") ?? "").trim() || null,
    popular: fd.get("popular") === "on", published: fd.get("published") === "on", order: num("order") ?? 100,
  };
  const verified = fd.get("verified") === "on";
  if (id) {
    const cur = await prisma.visaProduct.findUnique({ where: { id } });
    if (!cur) return;
    // a price change un-verifies until someone ticks the box again
    const priceChanged = cur.govtFee !== data.govtFee || cur.serviceFee !== data.serviceFee;
    await prisma.visaProduct.update({ where: { id }, data: { ...data, verifiedAt: verified ? (priceChanged || !cur.verifiedAt ? new Date() : cur.verifiedAt) : null } });
  } else {
    let slug = slugify(`${destSlug}-${name}`);
    for (let i = 2; await prisma.visaProduct.findUnique({ where: { slug } }); i++) slug = slugify(`${destSlug}-${name}-${i}`);
    await prisma.visaProduct.create({ data: { ...data, slug, verifiedAt: verified ? new Date() : null } });
  }
  (await import("@/lib/visa-service")).invalidateVisaProducts();
  revalidatePath("/admin/visas"); revalidatePath("/visa");
}

/** Move a visa application on (expert check, filed, issued, refused, cancelled). The traveller is emailed and pushed. */
export async function setVisaStageAction(fd: FormData) {
  await requireAdmin();
  const stage = String(fd.get("stage"));
  if (!["review", "submitted", "approved", "rejected", "cancelled"].includes(stage)) return;
  const { setStage } = await import("@/lib/visa-service");
  await setStage(String(fd.get("id")), stage as "review", String(fd.get("note") ?? "").trim().slice(0, 300) || undefined);
  revalidatePath("/admin/enquiries");
}

/** Upload the issued visa for one traveller; it appears on their application page and in their wallet. */
export async function uploadIssuedVisaAction(fd: FormData) {
  await requireAdmin();
  const e = await prisma.enquiry.findUnique({ where: { id: String(fd.get("id")) } });
  const file = fd.get("file");
  if (!e?.missionId || !(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) return;
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) return;
  const { uploadPrivate } = await import("@/lib/supabase");
  const key = `${e.missionId}/visa-${randomBytes(8).toString("hex")}.${file.type === "application/pdf" ? "pdf" : file.type.split("/")[1]}`;
  await uploadPrivate(key, Buffer.from(await file.arrayBuffer()), file.type);
  await prisma.travelDoc.create({ data: { missionId: e.missionId, applicant: Math.max(0, Number(fd.get("applicant")) || 0), kind: "visa_issued", fileKey: key, fileName: file.name.slice(0, 120) || "visa.pdf", mime: file.type, size: file.size, status: "ok", deleteAfter: new Date(Date.now() + 400 * 864e5) } });
  if (fd.get("approve") === "on") { const { setStage } = await import("@/lib/visa-service"); await setStage(e.id, "approved"); }
  revalidatePath("/admin/enquiries");
}

/* ---------- team: assignment, follow-ups, client notes, staff ---------- */

/** An employee takes a request from the shared queue (and the client, if they have no agent yet). */
export async function claimAction(fd: FormData) {
  const me = await requireStaff("work");
  const id = String(fd.get("id"));
  const e = await prisma.enquiry.findUnique({ where: { id } });
  if (!e || e.assigneeId) return;
  const { reassign } = await import("@/lib/assignment");
  const card = await prisma.clientCard.findUnique({ where: { email: e.email.toLowerCase() } });
  await reassign(id, me.id, me.email, !card?.managerId);
  revalidatePath("/admin", "layout");
}

/** A manager gives a request to someone (optionally making them the client's agent). */
export async function reassignAction(fd: FormData) {
  const me = await requireStaff("reassign");
  const to = String(fd.get("staffId") ?? "") || null;
  const { reassign } = await import("@/lib/assignment");
  await reassign(String(fd.get("id")), to, me.email, fd.get("client") === "on");
  revalidatePath("/admin", "layout");
}

export async function setClientManagerAction(fd: FormData) {
  const me = await requireStaff("reassign");
  const { setClientManager } = await import("@/lib/assignment");
  await setClientManager(String(fd.get("email")), String(fd.get("staffId") ?? "") || null, me.email, true);
  revalidatePath("/admin", "layout");
}

export async function handOverAction(fd: FormData) {
  const me = await requireStaff("reassign");
  const from = String(fd.get("from")), to = String(fd.get("to"));
  if (!from || !to || from === to) return;
  const { handOver } = await import("@/lib/assignment");
  await handOver(from, to, me.email);
  revalidatePath("/admin", "layout");
}

export async function addFollowUpAction(fd: FormData) {
  const me = await requireStaff("work");
  const { quickDue } = await import("@/lib/staff-rules");
  const pick = String(fd.get("when") ?? "tomorrow");
  const custom = String(fd.get("date") ?? "");
  const dueAt = /^\d{4}-\d{2}-\d{2}$/.test(custom) ? new Date(`${custom}T10:00:00+05:30`) : quickDue(new Date(), (["2h", "tomorrow", "3d", "week"].includes(pick) ? pick : "tomorrow") as "tomorrow");
  const title = String(fd.get("title") ?? "").trim().slice(0, 200);
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!title || !email) return;
  const staffId = String(fd.get("staffId") ?? "") || me.id;
  await prisma.followUp.create({ data: { email, enquiryId: String(fd.get("enquiryId") ?? "") || null, staffId, title, dueAt, createdBy: me.email } });
  revalidatePath("/admin", "layout");
}

export async function doneFollowUpAction(fd: FormData) {
  await requireStaff("work");
  await prisma.followUp.update({ where: { id: String(fd.get("id")) }, data: { doneAt: new Date() } });
  revalidatePath("/admin", "layout");
}

export async function snoozeFollowUpAction(fd: FormData) {
  await requireStaff("work");
  const { quickDue } = await import("@/lib/staff-rules");
  await prisma.followUp.update({ where: { id: String(fd.get("id")) }, data: { dueAt: quickDue(new Date(), fd.get("when") === "week" ? "week" : "tomorrow") } });
  revalidatePath("/admin", "layout");
}

export async function addClientNoteAction(fd: FormData) {
  const me = await requireStaff("work");
  const body = String(fd.get("body") ?? "").trim().slice(0, 4000);
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!body || !email) return;
  await prisma.clientNote.create({ data: { email, author: me.email, body } });
  revalidatePath("/admin/clients", "layout");
}

export async function setClientTagsAction(fd: FormData) {
  await requireStaff("work");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const tags = String(fd.get("tags") ?? "").split(",").map((t) => t.trim().toLowerCase().replace(/[^a-z0-9 -]/g, "")).filter(Boolean).slice(0, 10).join(",");
  await prisma.clientCard.upsert({ where: { email }, create: { email, tags }, update: { tags } });
  revalidatePath("/admin/clients", "layout");
}

export type ClientMailState = { ok?: boolean; error?: string } | undefined;
/** Email a client from their page. Replies come straight back to the employee who wrote. */
export async function emailClientAction(_: ClientMailState, fd: FormData): Promise<ClientMailState> {
  const me = await requireStaff("work");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const subject = String(fd.get("subject") ?? "").trim().slice(0, 140);
  const body = String(fd.get("body") ?? "").trim().slice(0, 8000);
  if (!email || !subject || body.length < 5) return { error: "Add a subject and a message." };
  const { sendEmail } = await import("@/lib/email");
  const { teamMessageEmail } = await import("@/lib/email-templates");
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ribriztravel.com").replace(/\/$/, "");
  const replyTo = me.email.endsWith(".local") ? undefined : me.email;
  const r = await sendEmail({ to: email, ...(replyTo ? { replyTo } : {}), ...teamMessageEmail({ subject, body, ref: "", hubUrl: `${site}/me` }) });
  if (!r.ok) return { error: `Not sent: ${r.error}` };
  await prisma.clientNote.create({ data: { email, author: me.email, kind: "email", subject, body } });
  revalidatePath("/admin/clients", "layout");
  return { ok: true };
}

export type StaffFormState = { ok?: boolean; error?: string } | undefined;
/** Owner: add an employee or change their role, availability for new clients, or access. */
export async function saveStaffAction(_: StaffFormState, fd: FormData): Promise<StaffFormState> {
  const me = await requireStaff("team");
  const id = String(fd.get("id") ?? "");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  const role = String(fd.get("role") ?? "agent");
  if (!["owner", "manager", "agent"].includes(role)) return { error: "Pick a role." };
  const data = { name, role, active: fd.get("active") === "on", takesNew: fd.get("takesNew") === "on" };
  if (id) {
    if (id === me.id && (role !== "owner" || !data.active)) return { error: "You can't remove your own owner access." };
    await prisma.staff.update({ where: { id }, data });
  } else {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || name.length < 2) return { error: "Add a name and a valid email." };
    if (await prisma.staff.findUnique({ where: { email } })) return { error: "That email is already on the team." };
    await prisma.staff.create({ data: { ...data, email, active: true } });
    if (process.env.E2E !== "1") {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({ to: email, subject: "You've been added to the Ribriz team", html: `<p>Hi ${name.split(" ")[0]},</p><p>${me.name} added you to Ribriz Travel's admin as ${role}. Sign in with this email address (we send you a one-time code):</p><p><a href="${(await import("@/lib/host-rules")).workspaceLink("/admin/login")}">${(await import("@/lib/host-rules")).workspaceLink("/admin/login")}</a></p>`, text: `${me.name} added you to Ribriz Travel's admin as ${role}. Sign in with this email: ${(await import("@/lib/host-rules")).workspaceLink("/admin/login")}` }).catch(() => {});
    }
  }
  revalidatePath("/admin/team");
  return { ok: true };
}
