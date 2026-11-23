import "server-only";
import { prisma } from "./db";
import { ownedBy, type Owner } from "./owner";
import { getProfile } from "./profile";
import { recommend, type Rec } from "./recommend";
import { getPublishedTrips } from "./trips";
import { getVisaRules } from "./visa-data";
import { isEasy, type VisaCategory } from "./visa";

/** Personal picks for one traveller: their memory, their trips in progress, and what they browsed. */
export async function forYou(owner: Owner, i: { viewed: string[]; saved: string[]; passport: string }, limit = 8): Promise<Rec[]> {
  const [trips, profile, rules] = await Promise.all([getPublishedTrips(), getProfile(owner), getVisaRules(i.passport)]);
  const missions = owner.customerId || owner.anonId
    ? await prisma.mission.findMany({ where: { AND: [ownedBy(owner), { tripId: { not: null } }] }, select: { tripId: true }, take: 20 })
    : [];
  const holds = owner.customerId && owner.email
    ? await prisma.enquiry.findMany({ where: { email: owner.email, tripId: { not: null } }, select: { tripId: true }, take: 20 })
    : [];
  const cat = new Map(rules.map((r) => [r.d, r.c as VisaCategory]));
  const easyVisa = (codes: string[]) => codes.length > 0 && codes.every((c) => c === i.passport || isEasy(cat.get(c) ?? "required"));
  const known = new Set(trips.map((t) => t.id));
  return recommend(trips, profile.prefs, {
    viewed: i.viewed.filter((x) => known.has(x)),
    saved: i.saved.filter((x) => known.has(x)),
    active: [...new Set([...missions, ...holds].map((x) => x.tripId!))],
  }, { easyVisa, limit });
}
