import { test } from "node:test";
import assert from "node:assert/strict";
import { judge, type Extracted } from "../lib/doc-rules.ts";
import { requirementsFor } from "../lib/visa-docs.ts";

const base: Extracted = { document_type: "passport", readable: true, quality_issues: [], passport: null, photo: null, statement: null, summary: "x" };

test("passport must be valid 6 months after return", () => {
  const ok = judge({ ...base, passport: { expiry_date: "2030-01-01", holder_name: "A B", nationality_code: "IN" } }, { passport: "IN", returnDate: "2026-12-20", strict: true }, "2026-11-23");
  assert.equal(ok.status, "ok");
  assert.equal(ok.keep.expiry, "2030-01-01");
  const short = judge({ ...base, passport: { expiry_date: "2027-03-01", holder_name: null, nationality_code: "IN" } }, { passport: "IN", returnDate: "2026-12-20", strict: true }, "2026-11-23");
  assert.equal(short.status, "issue");
  assert.match(short.findings.join(" "), /6 months after you return/);
  const expired = judge({ ...base, passport: { expiry_date: "2026-01-01", holder_name: null, nationality_code: "IN" } }, { passport: "IN", returnDate: null, strict: true }, "2026-11-23");
  assert.match(expired.findings[0], /expired/);
});

test("unreadable and quality issues are flagged", () => {
  assert.equal(judge({ ...base, readable: false }, { passport: "IN", returnDate: null, strict: false }).status, "unreadable");
  assert.equal(judge({ ...base, document_type: "other", quality_issues: ["blurry"] }, { passport: "IN", returnDate: null, strict: false }).status, "issue");
});

test("photo and statement rules", () => {
  const photo = judge({ ...base, document_type: "photo", photo: { plain_light_background: false, face_centered_and_fully_visible: true, eyes_open_looking_at_camera: true, glasses_or_headwear: true, sharp_and_well_lit: true } }, { passport: "IN", returnDate: null, strict: true });
  assert.equal(photo.status, "issue");
  assert.equal(photo.findings.length, 2);
  const stale = judge({ ...base, document_type: "bank_statement", statement: { holder_name: null, latest_transaction_date: "2026-09-01", months_covered: 2 } }, { passport: "IN", returnDate: null, strict: true }, "2026-11-23");
  assert.equal(stale.status, "issue");
  assert.equal(stale.findings.length, 2);
});

test("document lists by visa type", () => {
  assert.deepEqual(requirementsFor([{ country: "IN", cat: "own" }]), []);
  const voa = requirementsFor([{ country: "ID", cat: "voa" }]).map((r) => r.kind);
  assert.ok(voa.includes("passport") && !voa.includes("itr"));
  const schengen = requirementsFor([{ country: "FR", cat: "required" }, { country: "IT", cat: "required" }]);
  const kinds = schengen.map((r) => r.kind);
  for (const k of ["passport", "photo", "bank_statement", "itr", "employment_proof", "cover_letter", "insurance"]) assert.ok(kinds.includes(k as never), k);
  assert.ok(schengen.find((r) => r.kind === "hotel_booking")?.byRibriz);
});
