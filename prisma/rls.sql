-- Supabase exposes the public schema through its Data API, where the publishable
-- key is visible to anyone. Turning on row-level security with no policies means
-- that API can read or change nothing in these tables. The app itself connects
-- as the database owner through Prisma, which bypasses RLS, so it keeps working.
-- Safe to run more than once.
ALTER TABLE "Trip"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Departure"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enquiry"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscriber" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginCode"  ENABLE ROW LEVEL SECURITY;

-- Belt and braces: the public API roles get no table privileges at all.
REVOKE ALL ON "Trip", "Departure", "Enquiry", "Subscriber", "Customer", "LoginCode" FROM anon, authenticated;
