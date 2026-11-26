import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "../db";
import { withRef } from "../bookings";
import { dayKey, rateLimited } from "../http";
import { liveTrips } from "../live";
import { logEvent } from "../missions";
import { notifyEnquiry } from "../notify";
import { OFFER_LABEL } from "../offers";
import { ownedBy, type Owner } from "../owner";
import { payUrl, planOf } from "../payments";
import type { ToolOutcome, VisitorContext } from "./tools";

/*
 * Riya's after-booking tools: what the traveller has booked and paid, help on
 * the trip itself, and handing changes, cancellations, refunds and problems to
 * the team. None of them change a booking on their own.
 */

const TYPE: Record<string, string> = { hold: "Holiday", custom: "Custom trip", enquiry: "Question", visa: "Visa service", forex: "Forex", insurance: "Travel insurance", flight: "Flights", hotel: "Hotel" };

/** Requests this visitor may see: by their signed-in email, or linked to trips this browser owns. */
async function myRequests(owner: Owner) {
  const missions = await prisma.mission.findMany({ where: ownedBy(owner), select: { id: true }, take: 50 });
  const or = [
    ...(owner.customerId && owner.email ? [{ email: { equals: owner.email, mode: "insensitive" as const } }] : []),
    ...(missions.length ? [{ missionId: { in: missions.map((m) => m.id) } }] : []),
  ];
  if (!or.length) return [];
  return prisma.enquiry.findMany({
    where: { OR: or }, orderBy: { createdAt: "desc" }, take: 15,
    include: { payments: { orderBy: { createdAt: "asc" } }, offers: { where: { status: { in: ["chosen", "booked"] } } }, trip: { select: { title: true, slug: true, image: true, nights: true } }, mission: { select: { id: true, customerId: true, anonId: true } }, dep: { select: { status: true, seatsLeft: true } } },
  });
}

export const BookingsInput = z.object({});
async function bookingsTool(_: unknown, ctx: VisitorContext): Promise<ToolOutcome> {
  const rows = await myRequests(ctx.owner);
  const signedIn = !!ctx.owner.customerId;
  return {
    status: "",
    result: {
      signed_in: signedIn,
      ...(rows.length ? {} : { note: signedIn ? "Nothing booked or requested with this account yet." : "Nothing found for this browser. If they booked on another device or by email, ask them to sign in with that email." }),
      requests: rows.map((e) => {
        const plan = planOf(e);
        return {
          ref: e.ref, what: TYPE[e.type] ?? e.type, title: e.trip?.title ?? e.tripTitle, date: e.departure, status: e.status,
          trip_plan_id: e.missionId,
          total_inr: e.quotedTotal, paid_inr: plan.paid, balance_inr: plan.balance, balance_due: plan.balanceDue,
          next_payment: plan.next ? { kind: plan.next.kind, amount_inr: plan.next.amount, link: payUrl(e.ref) } : null,
          cannot_pay_because: plan.blocked ?? null,
          payments: e.payments.filter((p) => p.status !== "created" && p.status !== "failed").map((p) => ({ kind: p.kind, amount_inr: p.amount, status: p.status, refunded_inr: p.refundedAmount, paid_at: p.paidAt?.toISOString().slice(0, 10) ?? null })),
          confirmations: e.offers.map((o) => ({ what: OFFER_LABEL[o.service] ?? o.service, title: o.title, status: o.status, confirmation: o.confirmation })),
        };
      }),
      wallet: signedIn ? "/me/wallet (tickets, vouchers, receipts; works offline)" : "Sign in to see the wallet with receipts and documents.",
    },
  };
}

export const TodayInput = z.object({ trip_plan_id: z.string().max(40).optional() });
async function todayTool(i: z.infer<typeof TodayInput>, ctx: VisitorContext): Promise<ToolOutcome> {
  const trips = (await liveTrips(ctx.owner)).filter((t) => !i.trip_plan_id || t.missionId === i.trip_plan_id);
  if (!trips.length) return { status: "", result: { note: "No trip of theirs is starting within 3 days or happening now." } };
  return {
    status: "",
    result: {
      trips: trips.map((t) => ({
        trip_plan_id: t.missionId, where: t.dest, country: t.countryName, phase: t.phase, day: t.day, of_days: t.totalDays, days_to_go: t.daysToGo,
        today_plan: t.today, tomorrow_plan: t.tomorrow, local_time_zone: t.tz, time_vs_india: t.offset,
        weather: t.weather ? { now_c: t.weather.now, high_c: t.weather.max, low_c: t.weather.min, rain_chance: t.weather.rain, summary: t.weather.label, tomorrow: t.weather.tomorrow } : null,
        emergency_numbers: t.emergency, booking_references: t.bookings, currency: t.currency, plug_types: t.plug,
        checklist: t.phase === "leaving_soon" ? t.checklist.map((c) => c.text) : undefined,
      })),
    },
  };
}

const TOPICS = { change_dates: "Change dates", change_travellers: "Change travellers", cancel: "Cancel", refund: "Refund", problem_on_trip: "Problem on the trip", payment: "Payment question", other: "Question" } as const;
export const TeamInput = z.object({
  topic: z.enum(Object.keys(TOPICS) as [keyof typeof TOPICS, ...(keyof typeof TOPICS)[]]),
  message: z.string().trim().min(5).max(1500),
  ref: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(120).optional(),
  name: z.string().trim().max(80).optional(),
});
async function teamTool(i: z.infer<typeof TeamInput>, ctx: VisitorContext): Promise<ToolOutcome> {
  const o = ctx.owner;
  const email = (o.customerId && o.email) || i.email;
  if (!email) return { status: "", result: { error: "Need their email so the team can reply. Ask for it (or ask them to sign in), then call again." } };
  const who = o.customerId ? `c:${o.customerId}` : o.anonId ? `a:${o.anonId}` : `e:${email.toLowerCase()}`;
  if (await rateLimited(`team-day:${who}:${dayKey()}`, 6, 26 * 3600e3)) return { status: "", result: { error: "They've already sent several requests today. The team will reply to those first." } };

  const mine = await myRequests(o);
  const about = i.ref ? mine.find((e) => e.ref.toUpperCase() === i.ref!.toUpperCase()) : mine.find((e) => e.type === "hold" || e.type === "custom") ?? mine[0];
  if (i.ref && !about) return { status: "", result: { error: `No booking ${i.ref} on this account or browser. Ask them to sign in with the email they booked with.` } };

  const e = await withRef((ref) => prisma.enquiry.create({
    data: {
      ref, type: "enquiry", name: (i.name || o.name || about?.name || "Traveller").slice(0, 80), phone: about?.phone ?? o.phone ?? "", email,
      tripId: about?.tripId ?? null, tripTitle: about ? `${TOPICS[i.topic]}: ${about.trip?.title ?? about.tripTitle ?? about.ref}` : TOPICS[i.topic],
      departureId: about?.departureId ?? null, departure: about?.departure ?? null, adults: about?.adults ?? 1, children: about?.children ?? 0,
      missionId: about?.missionId ?? null,
      message: `${TOPICS[i.topic]}${about ? ` (booking ${about.ref})` : ""}, sent via Riya:\n\n${i.message}`,
    },
  }));
  if (about?.missionId) await logEvent(about.missionId, "traveller", `Asked our team: ${TOPICS[i.topic].toLowerCase()} (request ${e.ref}).`);
  after(() => notifyEnquiry(e.ref)); // the team gets an alert; the traveller gets a "we've got it" email
  const urgent = i.topic === "problem_on_trip";
  return {
    status: "",
    result: {
      sent: true, request_ref: e.ref, about_booking: about?.ref ?? null,
      what_happens: urgent
        ? "The team sees it as urgent and replies by email. For danger or a medical emergency, local emergency numbers come first (get_trip_today has them)."
        : "The team replies by email, usually within a few working hours, with options and any costs. Nothing changes until the traveller agrees.",
      policy: i.topic === "cancel" || i.topic === "refund" ? "Cancellation charges follow /legal/cancellation; refunds go back to the original payment method." : undefined,
    },
  };
}

export const CARE_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_my_bookings",
    description: "Everything this traveller has booked or requested: each holiday or service with its reference, status, total, what's paid, the balance and when it's due, the pay link for the next payment, refunds, and booking confirmations (PNR, voucher, policy). Use for \"what have I booked\", \"how much do I owe\", \"did my payment go through\", receipts, or before any change request.",
    eager_input_streaming: true,
    input_schema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "get_trip_today",
    description: "For a trip starting within 3 days or happening now: day N of M, today's and tomorrow's plan, local time, weather, local emergency numbers, booking references, currency and plug types (and the packing checklist before departure). Use whenever they're about to travel or are on their trip.",
    eager_input_streaming: true,
    input_schema: { type: "object", additionalProperties: false, properties: { trip_plan_id: { type: "string" } } },
  },
  {
    name: "contact_team",
    description: "Send the traveller's request to a person on the Ribriz team, who replies by email: changing dates or travellers, cancelling, a refund, a payment question, a problem during the trip, or anything you can't do. Include the booking reference when you know it and a clear message with every detail they gave (new dates, names, what went wrong). Confirm with them in one line before sending a cancellation. Guests who aren't signed in need to give an email.",
    eager_input_streaming: true,
    input_schema: {
      type: "object", additionalProperties: false, required: ["topic", "message"],
      properties: {
        topic: { type: "string", enum: Object.keys(TOPICS) },
        message: { type: "string", description: "What they need, in full, for the team" },
        ref: { type: "string", description: "Booking reference, e.g. RB-7K2Q9M" },
        email: { type: "string" }, name: { type: "string" },
      },
    },
  },
];

export const CARE_REGISTRY = {
  get_my_bookings: { schema: BookingsInput, run: bookingsTool },
  get_trip_today: { schema: TodayInput, run: todayTool },
  contact_team: { schema: TeamInput, run: teamTool },
} as const;

export const CARE_STATUS = { get_my_bookings: "Checking your bookings…", get_trip_today: "Checking today's plan…", contact_team: "Sending to our team…" };
export const CARE_DONE = { get_my_bookings: "Checked your bookings", get_trip_today: "Checked today's plan", contact_team: "Sent to our team" };
