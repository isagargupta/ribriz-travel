"use server";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { endSession, passwordMatches, requireAdmin, startSession } from "@/lib/auth";
import { BOARDS, KINDS, isoDate } from "@/lib/pricing";
import { setEnquiryStatus } from "@/lib/bookings";
import { buildSchedule } from "@/lib/schedule";
import { TRIPS_TAG } from "@/lib/trips";

/** Clear cached trip data so the public site shows changes immediately. */
function refreshSite() {
  revalidateTag(TRIPS_TAG);
  revalidatePath("/", "layout");
}

/* ---------- auth ---------- */
export async function login(_: { error?: string } | undefined, fd: FormData) {
  const pw = String(fd.get("password") ?? "");
  // small delay makes guessing slower
  await new Promise((r) => setTimeout(r, 400));
  if (!passwordMatches(pw)) return { error: "Wrong password. Check ADMIN_PASSWORD in your .env file." };
  await startSession();
  redirect("/admin");
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
  await setEnquiryStatus(id, status, note || null);
  refreshSite();
}

export async function deleteEnquiry(fd: FormData) {
  await requireAdmin();
  await prisma.enquiry.delete({ where: { id: String(fd.get("id")) } });
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
  const dir = path.join(process.cwd(), "uploads");
  await mkdir(dir, { recursive: true });
  const name = randomBytes(8).toString("hex") + ext;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/api/uploads/${name}`;
}

export type TripFormState = { error?: string } | undefined;

export async function saveTrip(_: TripFormState, fd: FormData): Promise<TripFormState> {
  await requireAdmin();
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
    flight: b("flight"), freeCancel: b("freeCancel"), tourManager: b("tourManager"), easyVisa: b("easyVisa"),
    lastMinute: b("lastMinute"), earlyBird: b("earlyBird"), featured: b("featured"), published: b("published"),
    image, highlights: s("highlights"), days: s("days"),
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

  refreshSite();
  redirect(id ? "/admin/trips?saved=1" : `/admin/trips/${tripId}?created=1#departures`);
}

export async function deleteTrip(fd: FormData) {
  await requireAdmin();
  await prisma.trip.delete({ where: { id: String(fd.get("id")) } });
  refreshSite();
  redirect("/admin/trips?deleted=1");
}

export async function togglePublished(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id"));
  const t = await prisma.trip.findUnique({ where: { id }, select: { published: true } });
  if (t) await prisma.trip.update({ where: { id }, data: { published: !t.published } });
  refreshSite();
}

export async function deleteSubscriber(fd: FormData) {
  await requireAdmin();
  await prisma.subscriber.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/admin/subscribers");
}

/* ---------- departures ---------- */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function addDeparture(fd: FormData) {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  await prisma.departure.delete({ where: { id: String(fd.get("id")) } });
  refreshSite();
}

/** Fill the calendar: one departure every N days for the next M months (existing dates are kept). */
export async function generateDepartures(fd: FormData) {
  await requireAdmin();
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
