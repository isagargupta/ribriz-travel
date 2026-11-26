import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { extract, judge } from "./doc-check";
import { getOwnedMission, logEvent, setTask } from "./missions";
import type { Owner } from "./owner";
import { addDays } from "./pricing";
import { removePrivate, uploadPrivate } from "./supabase";
import { getTripsForTravellers } from "./trips";
import { getVisaRules } from "./visa-data";
import { DOC_LABELS, requirementsFor, type DocKind, type DocRequirement } from "./visa-docs";
import { PROCESSING_DAYS, VISA_META, countryName, type VisaCategory } from "./visa";

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_IMAGE = 5 * 1024 * 1024;  // Claude's per-image limit
export const MAX_PDF = 10 * 1024 * 1024;
const DOC_KINDS = Object.keys(DOC_LABELS) as DocKind[];

export interface DocView { id: string; kind: DocKind; label: string; fileName: string; status: string; findings: string[]; createdAt: string }
export interface ChecklistItem extends DocRequirement { state: "ok" | "issue" | "checking" | "missing" | "by_ribriz" | "after_hold"; doc: DocView | null }
export interface Checklist {
  missionId: string; tripTitle: string | null; returnDate: string | null;
  countries: { country: string; type: string; days: number | null; processing: number }[];
  items: ChecklistItem[]; ready: number; needed: number; allReady: boolean; noVisaWork: boolean; others: DocView[];
}

const view = (d: { id: string; kind: string; fileName: string; status: string; findings: string | null; createdAt: Date }): DocView => ({
  id: d.id, kind: d.kind as DocKind, label: DOC_LABELS[d.kind as DocKind] ?? d.kind, fileName: d.fileName, status: d.status,
  findings: d.findings ? JSON.parse(d.findings) : [], createdAt: d.createdAt.toISOString(),
});

async function tripContext(mission: { tripId: string | null; departureId: string | null; passport: string }) {
  const trip = mission.tripId ? (await getTripsForTravellers()).find((t) => t.id === mission.tripId) ?? null : null;
  // the booked departure, even after it has left or closed for sale
  const dep = trip && mission.departureId ? await prisma.departure.findUnique({ where: { id: mission.departureId }, select: { date: true } }) : null;
  const returnDate = trip && dep ? addDays(dep.date, trip.nights) : null;
  const rules = await getVisaRules(mission.passport);
  const needs = (trip?.countryCodes ?? []).map((c) => ({ country: c, cat: (c === mission.passport ? "own" : rules.find((r) => r.d === c)?.c ?? "required") as VisaCategory, days: rules.find((r) => r.d === c)?.days ?? null }));
  return { trip, dep, returnDate, needs };
}

/** What the traveller needs for the visa on this mission, and where each document stands. */
export async function visaChecklist(owner: Owner, missionId: string): Promise<Checklist | null> {
  const m = await getOwnedMission(owner, missionId);
  if (!m) return null;
  const { trip, returnDate, needs } = await tripContext(m);
  const reqs = requirementsFor(needs);
  const docs = await prisma.travelDoc.findMany({ where: { missionId }, orderBy: { createdAt: "desc" } });
  const held = m.tasks.find((t) => t.kind === "price_hold")?.status === "done";
  const latest = new Map<string, (typeof docs)[number]>();
  for (const d of docs) if (!latest.has(d.kind)) latest.set(d.kind, d);

  const items: ChecklistItem[] = reqs.map((r) => {
    const d = latest.get(r.kind);
    const state: ChecklistItem["state"] = r.byRibriz ? (held ? "by_ribriz" : "after_hold")
      : !d ? "missing" : d.status === "ok" ? "ok" : d.status === "checking" ? "checking" : "issue";
    return { ...r, state, doc: d ? view(d) : null };
  });
  const mustUpload = items.filter((i) => i.required && !i.byRibriz);
  const ready = mustUpload.filter((i) => i.state === "ok").length;
  const usedIds = new Set(items.map((i) => i.doc?.id).filter(Boolean));
  return {
    missionId, tripTitle: trip?.title ?? null, returnDate,
    countries: needs.filter((n) => n.cat !== "own").map((n) => ({ country: countryName(n.country), type: VISA_META[n.cat].label, days: n.days, processing: PROCESSING_DAYS[n.cat] })),
    items, ready, needed: mustUpload.length, allReady: mustUpload.length > 0 && ready === mustUpload.length,
    noVisaWork: needs.every((n) => PROCESSING_DAYS[n.cat] === 0),
    others: docs.filter((d) => !usedIds.has(d.id)).map(view),
  };
}

async function refreshVisaTask(owner: Owner, missionId: string) {
  const c = await visaChecklist(owner, missionId);
  if (!c || c.noVisaWork) return c;
  const task = (await prisma.missionTask.findUnique({ where: { missionId_kind: { missionId, kind: "visa" } } }));
  if (task && (task.status === "waiting" || task.status === "done" || task.status === "needs_approval")) return c;
  await setTask(missionId, "visa", {
    status: "in_progress",
    note: c.allReady ? `All ${c.needed} documents are checked and ready. Next: send them to our visa team.` : `${c.ready} of ${c.needed} documents ready. Upload the rest in your trip hub or in chat.`,
  });
  return c;
}

export class UploadError extends Error {}

/** Stores the file privately, checks it with AI, files it under the right document type. */
export async function uploadDoc(owner: Owner, missionId: string, file: File, kindHint?: string | null) {
  const m = await getOwnedMission(owner, missionId);
  if (!m) throw new UploadError("We couldn't find that trip.");
  if (!ALLOWED_MIME.includes(file.type)) throw new UploadError("Upload a photo (JPG, PNG, WebP) or a PDF.");
  const max = file.type === "application/pdf" ? MAX_PDF : MAX_IMAGE;
  if (file.size > max) throw new UploadError(`That file is too big (max ${max / 1024 / 1024} MB).`);
  if ((await prisma.travelDoc.count({ where: { missionId } })) >= 40) throw new UploadError("This trip already has a lot of documents. Delete old ones first.");

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const key = `${missionId}/${randomBytes(10).toString("hex")}.${ext}`;
  await uploadPrivate(key, buf, file.type);

  const { returnDate, needs } = await tripContext(m);
  const hint = DOC_KINDS.includes(kindHint as DocKind) ? (kindHint as DocKind) : undefined;
  const doc = await prisma.travelDoc.create({
    data: {
      missionId, kind: hint ?? "other", fileKey: key, fileName: (file.name || `document.${ext}`).slice(0, 120), mime: file.type, size: file.size,
      deleteAfter: returnDate ? new Date(addDays(returnDate, 30) + "T00:00:00Z") : new Date(Date.now() + 180 * 864e5),
    },
  });

  let result;
  try {
    const x = await extract(buf, file.type);
    result = judge(x, { expectedKind: hint, passport: m.passport, returnDate, strict: needs.some((n) => n.cat === "required") });
  } catch (e) {
    console.error("doc check failed", e);
    result = { kind: hint ?? ("other" as DocKind), status: "unreadable" as const, findings: ["We couldn't check this automatically. Our visa team will review it, or try a clearer photo."], keep: {} };
  }
  const saved = await prisma.travelDoc.update({
    where: { id: doc.id },
    data: { kind: result.kind, status: result.status, findings: JSON.stringify(result.findings), extracted: Object.keys(result.keep).length ? JSON.stringify(result.keep) : null },
  });
  await logEvent(missionId, "traveller", `Uploaded ${DOC_LABELS[result.kind].toLowerCase()}: ${result.status === "ok" ? "looks good" : "needs attention"}.`);
  const checklist = await refreshVisaTask(owner, missionId);
  return { doc: view(saved), checklist };
}

export async function deleteDoc(owner: Owner, id: string) {
  const d = await prisma.travelDoc.findUnique({ where: { id } });
  if (!d || !(await getOwnedMission(owner, d.missionId))) return false;
  await removePrivate([d.fileKey]);
  await prisma.travelDoc.delete({ where: { id } });
  await refreshVisaTask(owner, d.missionId);
  return true;
}

/** Daily clean-up: documents past their keep-until date are deleted from storage and the database. */
export async function purgeExpiredDocs() {
  const old = await prisma.travelDoc.findMany({ where: { deleteAfter: { lt: new Date() } }, select: { id: true, fileKey: true }, take: 500 });
  await removePrivate(old.map((d) => d.fileKey));
  await prisma.travelDoc.deleteMany({ where: { id: { in: old.map((d) => d.id) } } });
  return old.length;
}

