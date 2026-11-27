import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import type { VisaProduct } from "@prisma/client";
import { prisma } from "./db";
import { withRef } from "./bookings";
import { logEvent } from "./missions";
import { ownedBy, type Owner } from "./owner";
import { payToken, payUrl, planOf } from "./payments";
import { safeEqual } from "./signing";
import { getPublishedTrips } from "./trips";
import { countryName } from "./visa";
import { DOC_LABELS, type DocKind } from "./visa-docs";
import { STAGES, VISA_KIND_LABEL, autoStage, deadlineCheck, visaPrice, visaReadyBy, type Stage, type VisaKind } from "./visa-service-rules";
import { PROCESSING_DAYS, type VisaCategory } from "./visa";
import { getVisaRules } from "./visa-data";
import { regionOf, type Region } from "./regions";
import { slugify } from "./climate-rules";

export const VISA_PRODUCTS_TAG = "visa-products";

export interface VisaDoc { kind: DocKind; label: string; note?: string }
export interface VisaProductView {
  id: string; slug: string; countryCode: string; country: string; destSlug: string; name: string;
  kind: VisaKind; kindLabel: string; entries: string; validityDays: number | null; stayDays: number | null;
  processingDays: number; needsAppointment: boolean; govtFee: number; serviceFee: number; perPerson: number;
  /** the government fee is confirmed by the team before payment; perPerson is then our fee + GST only */
  feeOnRequest: boolean;
  docs: VisaDoc[]; notes: string[]; popular: boolean; verified: boolean; readyBy: string; canApply: boolean;
  /** true for visas built from the public rules dataset rather than the team's catalogue */
  auto: boolean;
}
export interface VisaDestination {
  destSlug: string; countryCode: string; country: string; flag: string; region: Region; products: VisaProductView[];
  from: number; fromIsServiceOnly: boolean; fastest: number; image: string | null; popular: boolean; kinds: VisaKind[]; curated: boolean;
}

export const flagOf = (code: string) => code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

export function productView(p: VisaProduct, now = new Date()): VisaProductView {
  const price = visaPrice(p);
  return {
    id: p.id, slug: p.slug, countryCode: p.countryCode, country: countryName(p.countryCode), destSlug: p.destSlug, name: p.name,
    kind: p.kind as VisaKind, kindLabel: VISA_KIND_LABEL[p.kind as VisaKind] ?? p.kind, entries: p.entries,
    validityDays: p.validityDays, stayDays: p.stayDays, processingDays: p.processingDays, needsAppointment: p.needsAppointment,
    govtFee: p.govtFee, serviceFee: p.serviceFee, perPerson: price.perPerson, feeOnRequest: p.feeOnRequest,
    docs: JSON.parse(p.docs) as VisaDoc[], notes: (p.notes ?? "").split("\n").map((x) => x.trim()).filter(Boolean),
    popular: p.popular, verified: !!p.verifiedAt, readyBy: visaReadyBy(now, p.processingDays),
    canApply: p.serviceFee + p.govtFee > 0 && p.kind !== "arrival" && p.kind !== "visa_free" || (p.kind === "visa_free" && p.serviceFee > 0),
    auto: p.id.startsWith("auto-"),
  };
}

const loadProducts = unstable_cache(
  async () => prisma.visaProduct.findMany({ where: { published: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
  ["visa-products-v2"], { tags: [VISA_PRODUCTS_TAG], revalidate: 3600 },
);

/* Visas for countries the team hasn't priced yet, built from the public visa-rules dataset. */
const D = (kind: DocKind, label: string, note?: string): VisaDoc => ({ kind, label, ...(note ? { note } : {}) });
const BASIC_DOCS = [D("passport", "Passport: front and back pages", "Valid for 6 months after your return"), D("photo", "Passport-size photo", "Recent, white background"), D("flight_booking", "Return flight booking"), D("hotel_booking", "Hotel booking for your stay")];
const EMBASSY_DOCS = [...BASIC_DOCS.slice(0, 2), D("bank_statement", "Bank statements, last 6 months"), D("itr", "Income tax returns, last 3 years"), D("employment_proof", "Job proof", "Leave letter and salary slips, or business registration"), D("cover_letter", "Cover letter", "We can draft it for you"), ...BASIC_DOCS.slice(2)];

function autoProduct(code: string, cat: VisaCategory, days: number | null): VisaProduct | null {
  const country = countryName(code);
  const base = { id: `auto-${code}`, countryCode: code, destSlug: slugify(country), entries: "single", validityDays: null, stayDays: days, popular: false, published: true, order: 1000, verifiedAt: null, createdAt: new Date(0), updatedAt: new Date(0), feeOnRequest: true, govtFee: 0 };
  const stay = days ? ` for up to ${days} days` : "";
  switch (cat) {
    case "evisa": return { ...base, slug: `auto-${code.toLowerCase()}`, name: "Tourist e-Visa", kind: "evisa", processingDays: PROCESSING_DAYS.evisa, needsAppointment: false, serviceFee: 999, docs: JSON.stringify(BASIC_DOCS), notes: `Indian passport holders apply online for ${country}'s e-Visa. We prepare and file it, and email you the approved visa.\nThe government fee is confirmed by our visa team before you pay.` };
    case "eta": return { ...base, slug: `auto-${code.toLowerCase()}`, name: "Electronic Travel Authorisation (ETA)", kind: "eta", processingDays: PROCESSING_DAYS.eta, needsAppointment: false, serviceFee: 699, docs: JSON.stringify(BASIC_DOCS.slice(0, 2)), notes: `${country} needs an online travel authorisation before you fly. We file it for you.\nThe government fee is confirmed by our visa team before you pay.` };
    case "required": return { ...base, slug: `auto-${code.toLowerCase()}`, name: "Tourist visa (embassy)", kind: "sticker", processingDays: PROCESSING_DAYS.required, needsAppointment: true, serviceFee: 2499, docs: JSON.stringify(EMBASSY_DOCS), notes: `Indian passport holders apply through ${country}'s embassy or its visa centre. We prepare your file, fill the forms and book any appointment.\nProcessing times vary by embassy; the date shown is typical.\nThe embassy fee is confirmed by our visa team before you pay.` };
    case "voa": return { ...base, slug: `auto-${code.toLowerCase()}`, name: `Visa on arrival${stay}`, kind: "arrival", processingDays: 0, needsAppointment: false, serviceFee: 0, docs: "[]", feeOnRequest: false, notes: `Indian passport holders get a visa on arrival in ${country}${stay}.\nCarry a passport valid for 6 months, a return ticket, your hotel booking, passport photos and some cash or a card for any fee.` };
    case "visa_free": return { ...base, slug: `auto-${code.toLowerCase()}`, name: `Visa-free entry${stay}`, kind: "visa_free", processingDays: 0, needsAppointment: false, serviceFee: 0, docs: "[]", feeOnRequest: false, notes: `No visa needed for Indian passport holders${stay}.\nCarry a passport valid for 6 months, a return ticket and your hotel booking. Some countries also ask for an online arrival form before you fly.` };
    default: return null;
  }
}

/** Every destination: the team's priced catalogue first, then every other country from the visa-rules dataset. */
export async function visaDestinations(): Promise<VisaDestination[]> {
  const [rows, trips, rules] = await Promise.all([loadProducts(), getPublishedTrips(), getVisaRules("IN")]);
  const by = new Map<string, VisaProductView[]>();
  for (const r of rows) by.set(r.destSlug, [...(by.get(r.destSlug) ?? []), productView(r)]);
  const covered = new Set(rows.map((r) => r.countryCode));
  for (const r of rules) {
    if (covered.has(r.d) || r.d === "IN") continue;
    const p = autoProduct(r.d, r.c, r.days);
    if (p && !by.has(p.destSlug)) by.set(p.destSlug, [productView(p)]);
  }
  return [...by.entries()].map(([destSlug, ps]) => {
    const code = ps[0].countryCode;
    const trip = trips.find((t) => t.countryCodes.includes(code));
    const priced = ps.filter((p) => p.canApply);
    const cheapest = priced.sort((a, b) => a.perPerson - b.perPerson)[0];
    return {
      destSlug, countryCode: code, country: code === "AE" ? "Dubai (UAE)" : ps[0].country, flag: flagOf(code), region: regionOf(code), products: ps,
      from: cheapest?.perPerson ?? 0, fromIsServiceOnly: !!cheapest?.feeOnRequest, fastest: Math.min(...ps.map((p) => p.processingDays)),
      image: trip?.image ?? null, popular: ps.some((p) => p.popular), kinds: [...new Set(ps.map((p) => p.kind))], curated: ps.some((p) => !p.auto),
    };
  }).sort((a, b) => Number(b.curated) - Number(a.curated) || a.country.localeCompare(b.country));
}

export async function visaDestination(destSlug: string) {
  return (await visaDestinations()).find((d) => d.destSlug === destSlug) ?? null;
}

/** The product behind a slug: from the catalogue, or built from the rules dataset ("auto-jp"). */
export async function findVisaProduct(slug: string): Promise<VisaProduct | null> {
  if (slug.startsWith("auto-")) {
    const code = slug.slice(5).toUpperCase();
    const rule = (await getVisaRules("IN")).find((r) => r.d === code);
    return rule ? autoProduct(code, rule.c, rule.days) : null;
  }
  const p = await prisma.visaProduct.findUnique({ where: { slug } });
  return p?.published ? p : null;
}

export function invalidateVisaProducts() { revalidateTag(VISA_PRODUCTS_TAG, { expire: 0 }); }

/* ---------------- applications ---------------- */

export class VisaError extends Error {}

export interface ApplyInput {
  product: string; travellers: string[]; arrive: string; depart: string | null; purpose: string;
  name: string; email: string; phone: string;
}

/**
 * Starts an application: a request of type "visa" (payments, inbox, admin) and a
 * trip plan holding each traveller's documents. Payment comes after documents.
 */
export async function startApplication(owner: Owner, i: ApplyInput) {
  const p = await findVisaProduct(i.product);
  if (!p) throw new VisaError("That visa isn't available right now. Ask Riya and our team will help.");
  if (!productView(p).canApply) throw new VisaError("There's nothing to apply for: no visa is needed in advance.");
  const names = i.travellers.map((x) => x.trim()).filter(Boolean).slice(0, 9);
  if (!names.length) throw new VisaError("Add each traveller's name as on their passport.");
  const v = productView(p);
  const price = visaPrice(p, names.length);
  const country = countryName(p.countryCode);
  const mission = await prisma.mission.create({
    data: {
      customerId: owner.customerId, anonId: owner.anonId, title: `${country} visa`, goal: `${v.name} for ${names.length} traveller${names.length > 1 ? "s" : ""}.`,
      status: "active", adults: names.length, passport: "IN",
      tasks: { create: [{ kind: "visa", title: `${country} ${v.kindLabel}`, status: "in_progress", order: 2, note: "Upload passport and photo for each traveller, then pay to file.", dueDate: i.arrive }] },
    },
  });
  const e = await withRef((ref) => prisma.enquiry.create({
    data: {
      ref, type: "visa", name: i.name.slice(0, 80), phone: i.phone.slice(0, 30), email: i.email.toLowerCase().slice(0, 120),
      tripTitle: `${country}: ${v.name}`, departure: i.arrive, adults: names.length, travellers: JSON.stringify(names),
      // when the government fee isn't fixed, the team confirms the price (Admin → request → price) before payment
      quotedTotal: p.feeOnRequest ? null : price.total, missionId: mission.id,
      message: `${v.name} for ${names.length}: ${names.join(", ")}. Travelling ${i.arrive}${i.depart ? ` to ${i.depart}` : ""}. Purpose: ${i.purpose}.`,
      details: JSON.stringify({ product: p.slug, feeOnRequest: p.feeOnRequest, serviceTotal: price.total, visa: v.name, countries: country, travel_dates: `${i.arrive}${i.depart ? ` – ${i.depart}` : ""}`, travellers: names.join(", "), purpose: i.purpose, stage: "documents", readyBy: v.readyBy }),
    },
  }));
  await logEvent(mission.id, "traveller", `Started a ${country} ${v.kindLabel} application (${e.ref}) for ${names.join(", ")}.`);
  return { ref: e.ref, missionId: mission.id, token: payToken(e.ref) };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadApp>>>;
async function loadApp(ref: string) {
  return prisma.enquiry.findUnique({
    where: { ref },
    include: { payments: { orderBy: { createdAt: "asc" } }, trip: { select: { title: true, slug: true, image: true, nights: true } }, dep: { select: { status: true, seatsLeft: true } }, mission: { select: { id: true, customerId: true, anonId: true, documents: { orderBy: { createdAt: "desc" } } } } },
  });
}

/** Who may see an application: the link from our email, the browser or account that started it, or the signed-in email it was made with. */
async function mayView(e: Loaded, token: string | null, owner: Owner) {
  if (token && safeEqual(token, payToken(e.ref))) return true;
  if (owner.customerId && owner.email?.toLowerCase() === e.email.toLowerCase()) {
    // signed in with the email it was made with: the application moves to their account
    if (e.mission && !e.mission.customerId) await prisma.mission.update({ where: { id: e.mission.id }, data: { customerId: owner.customerId } });
    return true;
  }
  return !!e.mission && !!(await prisma.mission.findFirst({ where: { AND: [ownedBy(owner), { id: e.mission.id }] }, select: { id: true } }));
}

export interface ApplicationView {
  ref: string; token: string; missionId: string | null; product: VisaProductView | null; country: string; flag: string;
  travellers: { index: number; name: string; docs: { kind: DocKind; label: string; note?: string; uploaded: { id: string; fileName: string; status: string; findings: string[]; image: boolean }[] }[]; complete: boolean }[];
  /** the team still has to confirm the government fee before payment */
  awaitingPrice: boolean; serviceTotal: number; events: { at: string; text: string; actor: string }[];
  issued: { id: string; applicant: number; fileName: string }[];
  stage: Stage; stages: typeof STAGES; arrive: string | null; readyBy: string | null; deadline: ReturnType<typeof deadlineCheck>;
  total: number; paid: number; balance: number; payPath: string | null; canUpload: boolean; email: string;
}

export async function applicationView(ref: string, token: string | null, owner: Owner): Promise<ApplicationView | null> {
  const e = await loadApp(ref.toUpperCase());
  if (!e || e.type !== "visa" || !(await mayView(e, token, owner))) return null;
  const d = JSON.parse(e.details ?? "{}") as { product?: string; stage?: Stage; readyBy?: string; feeOnRequest?: boolean; serviceTotal?: number };
  const p = d.product ? await findVisaProduct(d.product) : null;
  const v = p ? productView(p) : null;
  const names: string[] = e.travellers ? JSON.parse(e.travellers) : [e.name];
  const docs = e.mission?.documents ?? [];
  const travellers = names.map((name, index) => {
    const mine = docs.filter((x) => x.applicant === index && x.kind !== "visa_issued");
    const req = (v?.docs ?? []).map((r) => ({ ...r, label: r.label || DOC_LABELS[r.kind], uploaded: mine.filter((x) => x.kind === r.kind).map((x) => ({ id: x.id, fileName: x.fileName, status: x.status, findings: x.findings ? JSON.parse(x.findings) as string[] : [], image: x.mime.startsWith("image/") })) }));
    return { index, name, docs: req, complete: req.every((r) => r.uploaded.length > 0) };
  });
  const plan = planOf(e);
  const docsComplete = travellers.every((t) => t.complete);
  const stage = autoStage((d.stage ?? "documents") as Stage, { docsComplete, paid: plan.paid > 0 && plan.balance === 0 });
  if (stage !== d.stage) await prisma.enquiry.update({ where: { id: e.id }, data: { details: JSON.stringify({ ...d, stage }) } });
  const owns = !!e.mission && !!(await prisma.mission.findFirst({ where: { AND: [ownedBy(owner), { id: e.mission.id }] }, select: { id: true } }));
  return {
    ref: e.ref, token: payToken(e.ref), missionId: e.missionId, product: v, country: v?.country ?? e.tripTitle ?? "Visa", flag: v ? flagOf(v.countryCode) : "🛂",
    travellers, issued: docs.filter((x) => x.kind === "visa_issued").map((x) => ({ id: x.id, applicant: x.applicant, fileName: x.fileName })),
    stage, stages: STAGES, arrive: e.departure, readyBy: d.readyBy ?? null, deadline: deadlineCheck(d.readyBy ?? "", e.departure),
    total: e.quotedTotal ?? 0, paid: plan.paid, balance: plan.balance, payPath: plan.next ? payUrl(e.ref) : null,
    canUpload: owns && stage !== "approved" && stage !== "cancelled", email: e.email,
    awaitingPrice: !e.quotedTotal, serviceTotal: d.serviceTotal ?? 0,
    events: e.missionId ? (await prisma.missionEvent.findMany({ where: { missionId: e.missionId }, orderBy: { createdAt: "desc" }, take: 8 })).map((x) => ({ at: x.createdAt.toISOString(), text: x.message, actor: x.actor })) : [],
  };
}

/** The team moves an application on: filed, issued, rejected or cancelled. Logs it for the traveller. */
export async function setStage(enquiryId: string, stage: Stage, note?: string) {
  const e = await prisma.enquiry.findUnique({ where: { id: enquiryId } });
  if (!e || e.type !== "visa") return null;
  const d = JSON.parse(e.details ?? "{}");
  await prisma.enquiry.update({ where: { id: e.id }, data: { details: JSON.stringify({ ...d, stage }), status: stage === "approved" ? "booked" : stage === "cancelled" || stage === "rejected" ? "closed" : stage === "submitted" ? "contacted" : e.status } });
  const words: Partial<Record<Stage, string>> = { review: "Our visa team is checking your documents.", submitted: "Your application has been filed with the embassy or government portal.", approved: "Your visa has been issued. Download it from your application page.", rejected: "Unfortunately the visa was refused. Our team will email you the reason and your options.", cancelled: "This application has been cancelled." };
  if (e.missionId) {
    await logEvent(e.missionId, "team", `${words[stage] ?? `Stage: ${stage}`}${note ? ` ${note}` : ""}`);
    const { setTask } = await import("./missions");
    await setTask(e.missionId, "visa", { status: stage === "approved" ? "done" : stage === "rejected" || stage === "cancelled" ? "skipped" : "waiting", note: words[stage] ?? null });
  }
  const { pushToEmail } = await import("./push");
  await pushToEmail(e.email, { title: stage === "approved" ? "Your visa is ready ✓" : "Visa update", body: words[stage] ?? stage, url: `/visa/application/${e.ref}?t=${payToken(e.ref)}`, tag: `visa-${e.ref}`, important: true });
  const { sendEmail } = await import("./email");
  const { visaStageEmail } = await import("./email-templates");
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ribriztravel.com").replace(/\/$/, "");
  await sendEmail({ to: e.email, idempotencyKey: `visa-${e.ref}-${stage}`, ...visaStageEmail({ name: e.name, ref: e.ref, title: e.tripTitle ?? "Your visa", stage, line: (words[stage] ?? "") + (note ? ` ${note}` : ""), url: `${site}/visa/application/${e.ref}?t=${payToken(e.ref)}` }) });
  return stage;
}

/** The slim card the browser gets for each destination. */
export function toCard(d: VisaDestination) {
  const p = d.products.filter((x) => x.canApply).sort((a, b) => a.perPerson - b.perPerson)[0] ?? d.products[0];
  return {
    slug: d.destSlug, code: d.countryCode, country: d.country, region: d.region, kind: p.kind, kindLabel: p.kindLabel,
    stay: p.stayDays, days: p.processingDays, readyBy: p.readyBy, from: d.from, serviceOnly: d.fromIsServiceOnly,
    canApply: p.canApply, curated: d.curated, popular: d.popular, appointment: p.needsAppointment,
  };
}
