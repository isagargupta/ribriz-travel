# Ribriz Travel

The Ribriz Travel website and admin panel: holiday packages, escorted group tours,
beach hotels and cruises, with a 48-hour price hold, enquiries and a newsletter.

Built with **Next.js 15** (App Router), **React 19**, **Prisma** and **SQLite** (switch to
Postgres for production hosting without a disk, see below).

## What's inside

**Customer site**
- `/`: photo slideshow, search, price ticker, trending trips, last-minute and early-bird deals
  with a countdown, travel styles, a 14-day cheapest-price calendar, newsletter sign-up
- `/trips`: search and filters (type, budget, region, stars, meal plan, free cancellation, etc.);
  filtered views have shareable links
- `/trips/[slug]`: full trip page with itinerary, inclusions, ratings, departure dates,
  price breakdown with 5% GST, EMI options, **price hold** and **question** forms, WhatsApp button
- `/compare`: up to 3 trips side by side
- `/saved`: trips saved with ♥ (kept in the visitor's browser)
- `/plan`: custom-trip request form
- Currency switch (₹ / € / zł) and departure city, used everywhere
- SEO: page titles and descriptions, `sitemap.xml`, `robots.txt`

**Admin panel** at `/admin` (password protected)
- Dashboard: new enquiries, last 7 days, bookings, value of open quotes
- Enquiries: every price hold, question and custom-trip request, with phone, email,
  WhatsApp link, status (new / contacted / booked / closed) and an internal note
- Trips: add, edit, hide, or delete trips; pick a photo or upload your own
- Subscribers: newsletter list with CSV download

## Run it on your computer

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env        # then edit .env: set ADMIN_PASSWORD and SESSION_SECRET
npm run setup               # creates the database and adds the 16 starter trips
npm run dev                 # http://localhost:3000
```

Admin panel: http://localhost:3000/admin (sign in with `ADMIN_PASSWORD` from `.env`).

To make a `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Settings (`.env`)

| Variable | What it does |
|---|---|
| `DATABASE_URL` | Database location. `file:./ribriz.db` for SQLite, or a Postgres URL |
| `ADMIN_PASSWORD` | Password for `/admin` |
| `SESSION_SECRET` | Random string (64 hex characters) that signs the admin login cookie |
| `NEXT_PUBLIC_PHONE` | Phone number shown in the footer |
| `NEXT_PUBLIC_EMAIL` | Email shown in the footer |
| `NEXT_PUBLIC_WHATSAPP` | WhatsApp number with country code, digits only (e.g. `919800000000`); shows a "Chat on WhatsApp" button on trip pages |
| `NEXT_PUBLIC_SITE_URL` | Your live address, e.g. `https://ribriztravel.com` (used in the sitemap and link previews) |

`NEXT_PUBLIC_*` values are baked in at build time: rebuild after changing them.

## Publish it

### Option A: a server with a disk (simplest, keeps SQLite and uploads)
Works on any VPS (DigitalOcean, Hostinger VPS, AWS Lightsail), Render with a persistent disk,
or Railway with a volume.

```bash
npm ci
cp .env.example .env         # fill in real values, NEXT_PUBLIC_SITE_URL = your domain
npm run setup                # first time only
npm run build
npm start                    # serves on port 3000; put Nginx or Caddy in front for HTTPS
```

Keep it running with `pm2 start npm --name ribriz -- start`.
Back up `prisma/ribriz.db` and the `uploads/` folder regularly.

### Option B: Vercel + Postgres
Vercel has no permanent disk, so use a hosted Postgres (Neon, Supabase or Vercel Postgres).

1. In `prisma/schema.prisma` change `provider = "sqlite"` to `provider = "postgresql"`.
2. Set `DATABASE_URL` to your Postgres connection string (locally and in Vercel).
3. Run `npm run setup` once against that database.
4. Push to GitHub, import the repo in Vercel, add all `.env` values in Project → Settings →
   Environment Variables, and deploy.
5. Photo uploads from the admin panel are saved to disk, which does not persist on Vercel.
   Put new photos in `public/img/` and redeploy, or add a storage service (e.g. Vercel Blob,
   Cloudinary) before relying on uploads.

## Before going live: checklist

- [ ] Replace the starter trips, prices, ratings and review counts with your real ones
      (Admin → Trips). The starter data is example content.
- [ ] Update the traveller stories and the stats on the home page
      (`app/(site)/page.tsx`); they are examples.
- [ ] Set your real phone, email and WhatsApp in `.env`.
- [ ] Use a long, unique `ADMIN_PASSWORD` and a fresh `SESSION_SECRET`.
- [ ] Check the exchange rates in `lib/pricing.ts` (`RATES`) and the city flight
      supplements (`FROM_CITIES`).
- [ ] Departure dates on trip pages are generated automatically from today's date.
      If you run fixed departures, tell customers dates are confirmed on enquiry, or
      ask a developer to add a departures table.
- [ ] Add privacy policy and terms pages if you collect customer data in your country.
- [ ] Online payment is **not** included: the hold and enquiry forms save the request and
      your team collects payment. A payment gateway (e.g. Razorpay) can be added later.

## Project layout

```
app/
  (site)/            customer pages (home, trips, trip page, compare, saved, plan)
  admin/             sign-in page, server actions, and the (panel) admin pages
  api/               enquiries, newsletter, uploaded photos
components/          UI pieces (cards, search, booking box, admin trip form…)
lib/                 database, pricing maths, filters, auth, validation
prisma/              schema.prisma and seed.mjs (starter trips)
public/img/          logo and destination photos (Unsplash)
prototype/           the original single-file design prototype, for reference
```

## Photo credits

Destination photos are from [Unsplash](https://unsplash.com) and used under the Unsplash License.
