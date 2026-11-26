import fs from "node:fs";
import { FRIEND_EMAIL, STATE, TEST_EMAIL, env, prisma, token } from "./helpers";
import teardown from "./global-teardown";

/** A test traveller and admin session for the run (anything left from an earlier run is removed first). */
export default async function setup() {
  await teardown();
  const c = await prisma.customer.create({ data: { email: TEST_EMAIL, name: "E2E Traveller" } });
  const f = await prisma.customer.create({ data: { email: FRIEND_EMAIL, name: "E2E Friend" } });
  const admin = (env().ADMIN_EMAILS || "").split(",")[0].trim().toLowerCase() || "password";
  fs.writeFileSync(STATE, JSON.stringify({ customerId: c.id, customer: token(c.id), friendId: f.id, friend: token(f.id), admin: token(Buffer.from(admin).toString("base64url")), startedAt: new Date().toISOString() }));
}
