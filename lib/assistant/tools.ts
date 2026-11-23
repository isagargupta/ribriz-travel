import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getDepartures, getPublishedTrips } from "../trips";
import { getVisaRules } from "../visa-data";
import { BOARDS, KINDS, adultPrice, addDays, daysBetween, emi, isoDate, quote } from "../pricing";
import { searchItems, tripFields } from "../search";
import { COUNTRY_NAMES } from "../country-names";
import { PROCESSING_DAYS, VISA_META, countryName, visaReadyWithin, type VisaCategory } from "../visa";
import type { DepartureDTO, TripDTO } from "../types";

/** Who is asking: set by the server from the visitor's saved preferences, never by the model. */
export interface VisitorContext { from: string; passport: string; adults: number; childAges: number[]; currency: string; name?: string | null }

/** Compact trip card the chat UI renders under a reply. Prices in INR per adult. */
export interface CardTrip { slug: string; title: string; image: string; dest: string; country: string; nights: number; price: number; date?: string | null; seats?: number | null; visa?: string }

export interface ToolOutcome { result: unknown; cards?: CardTrip[]; status: string }

const THEME_KEYS = ["honeymoon", "family", "group", "beach", "heritage", "nature", "city", "luxury"] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/* ---------------- schemas (validated before every run) ---------------- */

const SearchInput = z.object({
  query: z.string().max(120).optional(),
  max_price_per_adult_inr: z.number().int().positive().optional(),
  depart_after: date.optional(),
  depart_before: date.optional(),
  min_nights: z.number().int().min(1).max(60).optional(),
  max_nights: z.number().int().min(1).max(60).optional(),
  theme: z.enum(THEME_KEYS).optional(),
  visa_ready_within_days: z.number().int().min(0).max(90).optional(),
  sort: z.enum(["price", "rating", "soonest"]).optional(),
  limit: z.number().int().min(1).max(6).optional(),
}).strict();

const DealsInput = z.object({
  within_days: z.number().int().min(1).max(120).optional(),
  visa_ready_within_days: z.number().int().min(0).max(90).optional(),
  max_price_per_adult_inr: z.number().int().positive().optional(),
  theme: z.enum(THEME_KEYS).optional(),
  limit: z.number().int().min(1).max(6).optional(),
}).strict();

const TripInput = z.object({ slug: z.string().min(1).max(120) }).strict();
const VisaInput = z.object({ destination: z.string().min(2).max(80), passport: z.string().length(2).optional() }).strict();
const QuoteInput = z.object({
  slug: z.string().min(1).max(120),
  date,
  adults: z.number().int().min(1).max(9).optional(),
  child_ages: z.array(z.number().int().min(0).max(11)).max(6).optional(),
}).strict();

/* ---------------- definitions sent to Claude ---------------- */

const themeEnum = [...THEME_KEYS];
export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_trips",
    description: "Search Ribriz trips (packages, group tours, hotels, cruises) that are on sale. Every filter is optional; combine them to match what the traveller asked. Prices are per adult in INR for the traveller's departure city, before 5% GST. Use visa_ready_within_days when the traveller needs the visa sorted quickly (0 = visa-free or on arrival only). Returns at most `limit` trips; the chat shows them as cards automatically.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Destination, country, region or keyword, e.g. 'Bali', 'Europe', 'beach'. Typos are tolerated." },
        max_price_per_adult_inr: { type: "integer", description: "Budget per adult in INR." },
        depart_after: { type: "string", description: "Earliest departure date, YYYY-MM-DD." },
        depart_before: { type: "string", description: "Latest departure date, YYYY-MM-DD." },
        min_nights: { type: "integer" },
        max_nights: { type: "integer" },
        theme: { type: "string", enum: themeEnum },
        visa_ready_within_days: { type: "integer", description: "Only trips whose visas (for the traveller's passport) can be ready within this many days." },
        sort: { type: "string", enum: ["price", "rating", "soonest"] },
        limit: { type: "integer", description: "1-6, default 4." },
      },
    },
  },
  {
    name: "find_hot_deals",
    description: "Cheapest upcoming departures across all trips, best first, optionally only where the visa can be ready in time. Use for 'cheapest', 'deals', 'last minute', 'this weekend', 'next month' style requests.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        within_days: { type: "integer", description: "Look at departures in the next N days. Default 30." },
        visa_ready_within_days: { type: "integer", description: "Visa must be obtainable within this many days AND before the departure date." },
        max_price_per_adult_inr: { type: "integer" },
        theme: { type: "string", enum: themeEnum },
        limit: { type: "integer", description: "1-6, default 4." },
      },
    },
  },
  {
    name: "get_trip",
    description: "Full details of one trip by its slug: highlights, day-by-day plan, what's included, the next departure dates with prices and seats, and visa needs per country for the traveller's passport.",
    eager_input_streaming: true,
    input_schema: { type: "object", additionalProperties: false, required: ["slug"], properties: { slug: { type: "string" } } },
  },
  {
    name: "check_visa",
    description: "Visa requirement for a passport and destination country: visa-free (with days), visa on arrival, eTA, e-Visa or visa required, typical processing time and what to do. Defaults to the traveller's passport.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["destination"],
      properties: {
        destination: { type: "string", description: "Country name or 2-letter code, e.g. 'Thailand' or 'TH'." },
        passport: { type: "string", description: "2-letter code of the passport, only if different from the traveller's." },
      },
    },
  },
  {
    name: "quote_trip",
    description: "Exact price for one departure date of a trip and the traveller's group, calculated by Ribriz's pricing engine: per-person lines, 5% GST, total, deposit and EMI. Always use this for a final price; never compute totals yourself.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["slug", "date"],
      properties: {
        slug: { type: "string" },
        date: { type: "string", description: "A departure date returned by get_trip or search results, YYYY-MM-DD." },
        adults: { type: "integer", description: "Only if the traveller said a number different from their saved one." },
        child_ages: { type: "array", items: { type: "integer" }, description: "Ages 0-11 on return." },
      },
    },
  },
];

/* ---------------- helpers ---------------- */

const today = () => isoDate(new Date());
const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

async function visaFor(t: TripDTO, passport: string) {
  const rules = await getVisaRules(passport);
  return t.countryCodes.map((code) => {
    if (code === passport) return { country: countryName(code), type: "Home country", category: "own" as VisaCategory, days_allowed: null, processing_days: 0 };
    const r = rules.find((x) => x.d === code);
    const c: VisaCategory = r?.c ?? "required";
    return { country: countryName(code), type: VISA_META[c].label, category: c, days_allowed: r?.days ?? null, processing_days: PROCESSING_DAYS[c] };
  });
}

const visaShort = (v: Awaited<ReturnType<typeof visaFor>>) =>
  v.length ? [...new Set(v.map((x) => VISA_META[x.category].short))].join(" / ") : undefined;

function inWindow(d: DepartureDTO, after?: string, before?: string) {
  return (!after || d.date >= after) && (!before || d.date <= before);
}

function card(t: TripDTO, price: number, dep?: DepartureDTO | null, visa?: string): CardTrip {
  return { slug: t.slug, title: t.title, image: t.image, dest: t.dest, country: t.country, nights: t.nights, price, date: dep?.date ?? null, seats: dep?.seatsLeft ?? null, visa };
}

function summary(t: TripDTO) {
  return {
    slug: t.slug, title: t.title, destination: t.dest, countries: t.country, type: KINDS[t.kind], nights: t.nights,
    hotel_stars: t.stars, meals: BOARDS[t.board], rating: t.rating, reviews: t.reviews, flights_included: t.flight,
    free_cancellation: t.freeCancel, tour_manager: t.tourManager, themes: t.themes,
    beach_distance_m: t.beach, url: `${site()}/trips/${t.slug}`,
  };
}

/* ---------------- tool implementations ---------------- */

async function searchTrips(i: z.infer<typeof SearchInput>, ctx: VisitorContext): Promise<ToolOutcome> {
  let trips = await getPublishedTrips();
  if (i.query?.trim()) {
    const hits = searchItems(i.query, trips, tripFields, 50);
    trips = hits;
  }
  if (i.theme) trips = trips.filter((t) => t.themes.includes(i.theme!));
  if (i.min_nights) trips = trips.filter((t) => t.nights >= i.min_nights!);
  if (i.max_nights) trips = trips.filter((t) => t.nights <= i.max_nights!);

  const rows = [];
  for (const t of trips) {
    const deps = (await getDepartures(t.id)).filter((d) => inWindow(d, i.depart_after, i.depart_before));
    if (!deps.length) continue;
    const visa = await visaFor(t, ctx.passport);
    if (i.visa_ready_within_days !== undefined && !visaReadyWithin(visa.map((v) => v.category), i.visa_ready_within_days)) continue;
    const cheapest = deps.reduce((a, b) => (b.priceDelta < a.priceDelta ? b : a));
    const price = adultPrice(t.price, cheapest.priceDelta, t.flight, ctx.from);
    if (i.max_price_per_adult_inr && price > i.max_price_per_adult_inr) continue;
    rows.push({ t, deps, cheapest, price, visa });
  }
  const sort = i.sort ?? "price";
  rows.sort((a, b) => sort === "rating" ? b.t.rating - a.t.rating : sort === "soonest" ? a.deps[0].date.localeCompare(b.deps[0].date) : a.price - b.price);
  const top = rows.slice(0, i.limit ?? 4);

  return {
    status: `Searching ${i.query ? `“${i.query}” ` : ""}trips…`,
    result: {
      matches: rows.length,
      showing: top.length,
      trips: top.map((r) => ({
        ...summary(r.t),
        from_price_per_adult_inr: r.price,
        cheapest_date: r.cheapest.date,
        next_dates: r.deps.slice(0, 3).map((d) => d.date),
        visa_for_traveller: r.visa,
      })),
      note: rows.length === 0 ? "No trips match. Suggest relaxing a filter (dates, budget, visa time) or a custom trip at /plan." : undefined,
    },
    cards: top.map((r) => card(r.t, r.price, r.cheapest, visaShort(r.visa))),
  };
}

async function findHotDeals(i: z.infer<typeof DealsInput>, ctx: VisitorContext): Promise<ToolOutcome> {
  const start = today(), end = addDays(start, i.within_days ?? 30);
  const rows = [];
  for (const t of await getPublishedTrips()) {
    if (i.theme && !t.themes.includes(i.theme)) continue;
    const visa = await visaFor(t, ctx.passport);
    const need = Math.max(0, ...visa.map((v) => v.processing_days));
    if (i.visa_ready_within_days !== undefined && need > i.visa_ready_within_days) continue;
    // the visa must also be ready before the plane leaves
    const deps = (await getDepartures(t.id)).filter((d) => d.date >= start && d.date <= end && daysBetween(start, d.date) >= need);
    if (!deps.length) continue;
    const best = deps.reduce((a, b) => (b.priceDelta < a.priceDelta ? b : a));
    const price = adultPrice(t.price, best.priceDelta, t.flight, ctx.from);
    if (i.max_price_per_adult_inr && price > i.max_price_per_adult_inr) continue;
    const usual = adultPrice(t.was ?? t.price, 0, t.flight, ctx.from);
    rows.push({ t, best, price, visa, saving: Math.max(0, usual - price) });
  }
  rows.sort((a, b) => a.price - b.price);
  const top = rows.slice(0, i.limit ?? 4);
  return {
    status: "Finding the best deals…",
    result: {
      window: { from: start, to: end },
      deals: top.map((r) => ({
        ...summary(r.t), date: r.best.date, price_per_adult_inr: r.price, saving_vs_usual_inr: r.saving,
        seats_left: r.best.seatsLeft, days_until_departure: daysBetween(start, r.best.date), visa_for_traveller: r.visa,
      })),
      note: rows.length === 0 ? "No departures match in this window. Offer a longer window or visa-free options." : undefined,
    },
    cards: top.map((r) => card(r.t, r.price, r.best, visaShort(r.visa))),
  };
}

async function getTrip(i: z.infer<typeof TripInput>, ctx: VisitorContext): Promise<ToolOutcome> {
  const t = (await getPublishedTrips()).find((x) => x.slug === i.slug);
  if (!t) return { status: "Looking up the trip…", result: { error: "No trip with that slug. Use search_trips to find the right one." } };
  const deps = (await getDepartures(t.id)).slice(0, 8);
  const visa = await visaFor(t, ctx.passport);
  const cheapest = deps.length ? deps.reduce((a, b) => (b.priceDelta < a.priceDelta ? b : a)) : null;
  return {
    status: `Opening ${t.dest}…`,
    result: {
      ...summary(t),
      highlights: t.highlights,
      itinerary: t.days.map((d, n) => `Day ${n + 1}: ${d}`),
      departures: deps.map((d) => ({ date: d.date, price_per_adult_inr: adultPrice(t.price, d.priceDelta, t.flight, ctx.from), seats_left: d.seatsLeft })),
      visa_for_traveller: visa,
      team_visa_note: t.visaNote,
    },
    cards: [card(t, adultPrice(t.price, cheapest?.priceDelta ?? t.minDelta, t.flight, ctx.from), cheapest, visaShort(visa))],
  };
}

async function checkVisa(i: z.infer<typeof VisaInput>, ctx: VisitorContext): Promise<ToolOutcome> {
  const passport = (i.passport ?? ctx.passport).toUpperCase();
  const raw = i.destination.trim();
  const codes = Object.keys(COUNTRY_NAMES);
  const code = /^[A-Za-z]{2}$/.test(raw) && COUNTRY_NAMES[raw.toUpperCase()]
    ? raw.toUpperCase()
    : searchItems(raw, codes, (c) => [{ text: COUNTRY_NAMES[c], weight: 3 }], 1)[0];
  if (!code) return { status: "Checking visa rules…", result: { error: `Couldn't find a country called "${raw}".` } };
  const rules = await getVisaRules(passport);
  const r = rules.find((x) => x.d === code);
  const c: VisaCategory = code === passport ? "own" : r?.c ?? "required";
  const trips = (await getPublishedTrips()).filter((t) => t.countryCodes.includes(code));
  return {
    status: `Checking visa rules for ${countryName(code)}…`,
    result: {
      passport: countryName(passport), destination: countryName(code), type: VISA_META[c].label,
      days_allowed: r?.days ?? null, typical_processing_days: PROCESSING_DAYS[c], what_to_do: VISA_META[c].blurb,
      ribriz_trips_there: trips.map((t) => ({ slug: t.slug, title: t.title })),
      source: "Passport Index dataset (may lag official changes); confirm on the official government site before travel.",
      visa_checker_url: `${site()}/visa?to=${code}`,
    },
  };
}

async function quoteTrip(i: z.infer<typeof QuoteInput>, ctx: VisitorContext): Promise<ToolOutcome> {
  const t = (await getPublishedTrips()).find((x) => x.slug === i.slug);
  if (!t) return { status: "Pricing…", result: { error: "No trip with that slug." } };
  const dep = (await getDepartures(t.id)).find((d) => d.date === i.date);
  if (!dep) return { status: "Pricing…", result: { error: "That date isn't an open departure. Use get_trip to see dates." } };
  const adults = i.adults ?? ctx.adults, ages = i.child_ages ?? ctx.childAges;
  const q = quote({ base: t.price, delta: dep.priceDelta, flight: t.flight, from: ctx.from, adults, childAges: ages });
  return {
    status: "Working out your price…",
    result: {
      trip: t.title, date: dep.date, return_date: addDays(dep.date, t.nights), from_city: t.flight ? ctx.from : null,
      lines: q.lines, subtotal_inr: q.subtotal, gst_inr: q.gst, total_inr: q.total, per_person_inr: q.perPerson,
      deposit_to_book_inr: q.deposit, emi_6_months_no_cost_inr: Math.round(emi(q.total, 6)), seats_left: dep.seatsLeft,
      reserve_url: `${site()}/trips/${t.slug}?date=${dep.date}`,
      how_to_book: "Open the trip, pick this date and press 'Reserve this price' for a free 48-hour hold. No payment online.",
    },
    cards: [card(t, q.perAdult, dep)],
  };
}

/* ---------------- dispatcher ---------------- */

const REGISTRY = {
  search_trips: { schema: SearchInput, run: searchTrips },
  find_hot_deals: { schema: DealsInput, run: findHotDeals },
  get_trip: { schema: TripInput, run: getTrip },
  check_visa: { schema: VisaInput, run: checkVisa },
  quote_trip: { schema: QuoteInput, run: quoteTrip },
} as const;

export const TOOL_STATUS: Record<string, string> = {
  search_trips: "Searching trips…", find_hot_deals: "Finding the best deals…", get_trip: "Opening the trip…",
  check_visa: "Checking visa rules…", quote_trip: "Working out your price…",
};

/** Validates the model's input against the schema, then runs the tool. Errors come back as results, never throws. */
export async function runTool(name: string, input: unknown, ctx: VisitorContext): Promise<ToolOutcome & { isError?: boolean }> {
  const entry = REGISTRY[name as keyof typeof REGISTRY];
  if (!entry) return { status: "…", result: { error: `Unknown tool ${name}` }, isError: true };
  const parsed = entry.schema.safeParse(input ?? {});
  if (!parsed.success) return { status: TOOL_STATUS[name], result: { error: "Invalid input", issues: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`) }, isError: true };
  try {
    // each tool's run takes its own schema's output type
    return await (entry.run as (i: unknown, c: VisitorContext) => Promise<ToolOutcome>)(parsed.data, ctx);
  } catch (e) {
    console.error("assistant tool failed", name, e);
    return { status: TOOL_STATUS[name], result: { error: "The lookup failed. Try again or offer to connect the traveller with an expert." }, isError: true };
  }
}
