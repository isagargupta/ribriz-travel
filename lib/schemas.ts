import { z } from "zod";
import { FROM_CITIES, MAX_ADULTS, MAX_CHILDREN } from "./pricing";

const name = z.string().trim().min(2, "Enter your full name.").max(120);
const phone = z.string().trim().regex(/^\+?[\d\s()-]{7,20}$/, "Enter a valid mobile number, for example +91 98765 43210.");
const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(160);
const message = z.string().trim().max(2000).optional().default("");
const from = z.string().refine((c) => c in FROM_CITIES, "Choose a departure city.").default("Mumbai");
const adults = z.coerce.number().int().min(1).max(MAX_ADULTS);
const childAges = z.array(z.coerce.number().int().min(0).max(11)).max(MAX_CHILDREN).default([]);

export const contactSchema = z.object({ name, phone, email });

export const holdSchema = z.object({
  departureId: z.string().min(1).max(40),
  adults, childAges, from,
  name, phone, email,
  travellers: z.array(z.string().trim().max(120)).max(MAX_ADULTS + MAX_CHILDREN).default([]),
  message,
  /** total the customer saw; if it no longer matches we ask them to confirm the new one */
  expectedTotal: z.coerce.number().int().nonnegative(),
});

export const enquirySchema = z.object({
  type: z.enum(["enquiry", "custom"]),
  tripId: z.string().max(40).optional(),
  departureId: z.string().max(40).optional(),
  adults: adults.default(2), childAges, from,
  name, phone, email, message,
});

export const lookupSchema = z.object({
  ref: z.string().trim().toUpperCase().regex(/^RB-[A-Z0-9]{6}$/, "References look like RB-7K2Q9M."),
  email,
});

export const newsletterSchema = z.object({ email });

/** First error message, for showing to the customer. */
export function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Please check the form and try again.";
}

export const priceWatchSchema = z.object({
  slug: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  email: email.optional(),
  from: z.string().max(40).optional(),
});
