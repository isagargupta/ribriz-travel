# Ribriz Travel

The Ribriz Travel website and admin panel: holiday packages, escorted group tours,
beach hotels and cruises, with a 48-hour price hold, enquiries and a newsletter.

Built with **Next.js 15** (App Router), **React 19**, **Prisma** and **Supabase** (Postgres database
and Storage for admin photo uploads).

## What's inside

**Customer site**
- `/`: photo slideshow, search, live price ticker, "recently viewed", trending trips,
  last-minute and early-bird deals with a countdown, travel styles, a 14-day cheapest-price
  calendar built from real departures, "how booking works", newsletter sign-up
- **⌘K / Ctrl+K search** on every page: typo-tolerant ("maldvies" finds Maldives), shows prices
- `/trips`: filters with live counts, typo-tolerant search, date filter that uses real
  departures, shareable filtered links, slide-up filter panel on phones
- `/trips/[slug]`: month calendar of departures coloured by price, seats left, live price
  breakdown, EMI, sticky price bar on phones, and a 3-step **reserve flow** (free 48-hour
  price hold, no payment) with a reference number and an "add to calendar" file
- `/booking`: customers look up a hold with their reference + email and see a live countdown
  and status timeline
- `/compare`, `/saved`, `/plan` (custom trip request)
- Prices per adult or as the **total for your group incl. GST** (switch in the header), in
  ₹ / € / zł, with a "what's in this price" explainer on every card
- Motion: page transitions, scroll reveals, animated price changes, skeleton loaders;
  all motion turns off for visitors who prefer reduced motion
- SEO: titles, descriptions, structured data for trips, `sitemap.xml`, `robots.txt`

**Admin panel** at `/admin` (password protected)
- Dashboard: new enquiries, last 7 days, bookings, value of open quotes
- Enquiries: holds, questions and custom requests with reference, travellers, hold expiry,
  WhatsApp link, status and internal notes. **Marking a hold "booked" takes the seats off
  that departure**; moving it back returns them
- Trips: add, edit, hide or delete; pick or upload a photo
- **Departure dates** per trip: generate a schedule (every N days for M months), add single
  dates, change each date's price, seats or close it
- Subscribers with CSV download

## How it's built

| Layer | Where | Notes |
|---|---|---|
| Price engine | `lib/pricing.ts` | One pure `quote()` used by every page **and** the server |
| Search | `lib/search.ts` | Weighted fuzzy matching with edit distance |
| Schedules | `lib/schedule.ts` | Seasonal, weekday and last-minute pricing for departures |
| Data access | `lib/trips.ts` | Cached reads; the admin clears the cache on every save |
| Bookings | `lib/bookings.ts` | Re-prices on the server, checks seats and dates, seat accounting |
| Validation | `lib/schemas.ts` | zod schemas for every form and API |
| Tests | `tests/` | `npm test` covers pricing, search and scheduling |

The server never trusts a price from the browser: when someone reserves, it recalculates the
total from the database and asks them to confirm if it changed.

## Run it on your computer

Requires Node.js 22.6 or newer and a Supabase project.

```bash
npm install
cp .env.example .env          # then fill it in (see "Settings" below)
node scripts/set-secrets.mjs  # optional: types the DB password + secret key in, hidden
npm run setup                 # creates tables, locks them, adds 16 trips and 6 months of dates
npm run dev                   # http://localhost:3000
```

Admin panel: http://localhost:3000/admin (sign in with `ADMIN_PASSWORD` from `.env`).

To make a `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Settings (`.env`)

| Variable | What it does |
|---|---|
| `DATABASE_URL` | Supabase pooled connection (port 6543), from Supabase → Connect → ORMs → Prisma |
| `DIRECT_URL` | Supabase direct connection (port 5432), used to create and change tables |
| `NEXT_PUBLIC_SUPABASE_URL` | Your project URL, e.g. `https://abcd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public key (safe to expose; the tables are locked against it) |
| `SUPABASE_SECRET_KEY` | **Server-only** secret key (`sb_secret_…`), used to store admin photo uploads |
| `ADMIN_PASSWORD` | Password for `/admin` |
| `SESSION_SECRET` | Random string (64 hex characters) that signs the admin login cookie |
| `NEXT_PUBLIC_PHONE` / `NEXT_PUBLIC_EMAIL` | Contact details in the footer |
| `NEXT_PUBLIC_WHATSAPP` | WhatsApp number with country code, digits only (e.g. `919800000000`) |
| `NEXT_PUBLIC_SITE_URL` | Your live address, e.g. `https://ribriztravel.com` |

`NEXT_PUBLIC_*` values are baked in at build time: rebuild after changing them.
Never commit `.env` or share `SUPABASE_SECRET_KEY` / the database password.

## How Supabase is used

- **Database:** all reads and writes go through Prisma on the server, connected as the database
  owner. `prisma/rls.sql` turns on row-level security with no policies and revokes table access
  from Supabase's public API roles, so the publishable key can't read customer data.
  `npm run db:push` re-applies it every time. If you add a table, add it to `rls.sql` too.
- **Storage:** admin photo uploads go to a public `trip-photos` bucket (created automatically on
  the first upload). Bundled photos stay in `public/img/`.
- **Region:** put the app's hosting in the same region as the database. Each page talks to the
  database several times, so distance adds delay.

## Publish it

### Option A: Vercel (simplest)
1. Import the GitHub repository at vercel.com.
2. Add every `.env` value in Project → Settings → Environment Variables.
3. Set the function region (Project → Settings → Functions) to the one closest to your
   Supabase project.
4. Deploy. The database is already set up, so there's nothing else to run.

### Option B: your own server (VPS, Render, Railway)
```bash
npm ci
cp .env.example .env         # fill in real values, NEXT_PUBLIC_SITE_URL = your domain
npm run build
npm start                    # port 3000; put Nginx or Caddy in front for HTTPS
```
Keep it running with `pm2 start npm --name ribriz -- start`.

For production, use Supabase's paid plan: free projects pause after a week without traffic and
have no daily backups.

## Before going live: checklist

- [ ] Replace the starter trips, prices, ratings and review counts with your real ones
      (Admin → Trips). The starter data is example content.
- [ ] Update the traveller stories and the stats on the home page
      (`app/(site)/page.tsx`); they are examples.
- [ ] Set your real phone, email and WhatsApp in `.env`.
- [ ] Use a long, unique `ADMIN_PASSWORD` and a fresh `SESSION_SECRET`.
- [ ] Move to Supabase's paid plan (no pausing, daily backups).
- [ ] Check the exchange rates in `lib/pricing.ts` (`RATES`) and the city flight
      supplements (`FROM_CITIES`).
- [ ] Review each trip's departure dates, prices and seats (Admin → Trips → a trip →
      Departure dates). The starter schedule is generated automatically.
- [ ] Add privacy policy and terms pages if you collect customer data in your country.
- [ ] Online payment is **not** included: a reservation is a free 48-hour hold and your team
      collects the deposit. A payment gateway (e.g. Razorpay) can be added later.
- [ ] Rate limiting is in-memory (per server). Behind several servers, use a shared store.

## Project layout

```
app/
  (site)/            customer pages (home, trips, trip page, booking, compare, saved, plan)
  admin/             sign-in page, server actions, and the (panel) admin pages
  api/               enquiries, newsletter, uploaded photos
components/          UI pieces (cards, search, booking box, admin trip form…)
lib/                 price engine, search, schedules, data access, bookings, auth, validation
prisma/              schema.prisma, rls.sql (table lockdown), seed.ts (starter trips + departures)
scripts/             set-secrets.mjs (adds DB password + secret key to .env, hidden)
tests/               unit tests (npm test)
public/img/          logo and destination photos (Unsplash)
prototype/           the original single-file design prototype, for reference
```

## Photo credits

Destination photos are from [Unsplash](https://unsplash.com) and used under the Unsplash License.
