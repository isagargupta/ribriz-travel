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
ALTER TABLE "VisaRule"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VisaSync"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Mission"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MissionTask"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Approval"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MissionEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TravelDoc"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceWatch"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentRun"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailOptOut"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceOffer" ENABLE ROW LEVEL SECURITY;

-- Belt and braces: the public API roles get no table privileges at all.
REVOKE ALL ON "Trip", "Departure", "Enquiry", "Subscriber", "Customer", "LoginCode", "VisaRule", "VisaSync", "Mission", "MissionTask", "Approval", "MissionEvent", "TravelDoc", "Notification", "PriceWatch", "AgentRun", "EmailOptOut", "ServiceOffer" FROM anon, authenticated;
