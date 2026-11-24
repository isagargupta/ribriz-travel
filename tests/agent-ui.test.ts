import { test } from "node:test";
import assert from "node:assert/strict";
import { blockAsText } from "../lib/assistant/ui.ts";

test("on-screen blocks are summarised for Riya's memory of the chat", () => {
  assert.match(blockAsText({ kind: "ask", id: "a", submit: "Go", questions: [{ id: "t", label: "What kind of trip?", type: "single", options: [{ label: "Beach" }, { label: "Heritage" }] }] }), /What kind of trip\? \(Beach \/ Heritage\)/);
  assert.match(blockAsText({ kind: "trips", id: "b", items: [{ slug: "phuket-krabi-6n", title: "", image: "", dest: "", country: "", nights: 6, price: 1, date: "2026-12-14", seats: null, badge: "Riya's pick" }] }), /phuket-krabi-6n 2026-12-14 "Riya's pick"/);
  assert.equal(blockAsText({ kind: "actions", id: "c", items: [{ label: "Hold it" }, { label: "Cheaper" }] }), "[Next-step buttons: Hold it | Cheaper]");
});
