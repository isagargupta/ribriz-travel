import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { joinMission, validJoin } from "@/lib/group";
import { fmtDate } from "@/lib/pricing";
import { getTripsForTravellers } from "@/lib/trips";

export const metadata: Metadata = { title: "Join a trip", robots: { index: false } };
export const dynamic = "force-dynamic";

async function join(fd: FormData) {
  "use server";
  const id = String(fd.get("id")), t = String(fd.get("t"));
  const me = await currentCustomer();
  if (!me || !validJoin(id, t)) redirect("/");
  await joinMission(id, me.id, String(fd.get("name") ?? "").trim().slice(0, 80) || me.name);
  redirect(`/me/trips/${id}`);
}

/** Invite link for a group trip: see the trip, sign in, join. */
export default async function JoinPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  if (!validJoin(id, t)) notFound();
  const m = await prisma.mission.findUnique({ where: { id }, select: { title: true, tripId: true, departureId: true, customerId: true, adults: true, members: { select: { customerId: true } } } });
  if (!m) notFound();
  const me = await currentCustomer();
  if (me && (m.customerId === me.id || m.members.some((x) => x.customerId === me.id))) redirect(`/me/trips/${id}`);
  const trip = m.tripId ? (await getTripsForTravellers()).find((x) => x.id === m.tripId) : null;
  const dep = m.departureId ? await prisma.departure.findUnique({ where: { id: m.departureId }, select: { date: true } }) : null;
  const owner = m.customerId ? await prisma.customer.findUnique({ where: { id: m.customerId }, select: { name: true } }) : null;
  const here = `/join/${id}?t=${t}`;

  return (
    <div className="login-card join-card">
      {trip && <span className="join-img"><Image src={trip.image} alt="" fill sizes="480px" /></span>}
      <span className="kicker">You&apos;re invited</span>
      <h1 style={{ fontSize: 26, margin: "4px 0" }}>{owner?.name?.split(" ")[0] ? `Join ${owner.name.split(" ")[0]}'s trip` : "Join this trip"}</h1>
      <p className="muted" style={{ margin: 0 }}>{trip ? <><b>{trip.title}</b>{dep ? <> · {fmtDate(dep.date, { day: "numeric", month: "short", year: "numeric" })}</> : null}</> : m.title} · {m.adults} adult{m.adults > 1 ? "s" : ""}</p>
      <ul className="join-perks"><li>See the trip, bookings and updates in your own Ribriz app</li><li>Upload your own passport and visa documents</li><li>Pay your share of the cost online</li></ul>
      {me ? (
        <form action={join} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="t" value={t} />
          <label>Your name as on your passport<input name="name" defaultValue={me.name ?? ""} required maxLength={80} /></label>
          <button className="btn hot">Join the trip</button>
        </form>
      ) : <Link className="btn hot" href={`/login?next=${encodeURIComponent(here)}`}>Sign in to join (email code, no password)</Link>}
    </div>
  );
}
