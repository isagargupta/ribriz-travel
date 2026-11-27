import { test } from "node:test";
import assert from "node:assert/strict";
import { routeHost } from "../lib/host-rules.ts";

const WS = "https://workspace.ribriztravel.com";

test("workspace host: home opens the staff app, staff pages and APIs load, public pages go to www", () => {
  assert.deepEqual(routeHost("workspace.ribriztravel.com", "/", ""), { redirect: "/admin" });
  assert.deepEqual(routeHost("workspace.ribriztravel.com", "/admin/clients", "?q=a"), { pass: true, noindex: true });
  assert.deepEqual(routeHost("workspace.ribriztravel.com", "/api/docs/1", ""), { pass: true, noindex: true });
  assert.deepEqual(routeHost("workspace.ribriztravel.com", "/logo.png", ""), { pass: true, noindex: true });
  assert.deepEqual(routeHost("workspace.ribriztravel.com", "/trips/bali", "?x=1"), { redirect: "https://www.ribriztravel.com/trips/bali?x=1" });
  assert.deepEqual(routeHost("workspace.ribriztravel.com", "/administrator", ""), { redirect: "https://www.ribriztravel.com/administrator" });
});

test("main site: /admin moves to the workspace only once it's switched on", () => {
  assert.deepEqual(routeHost("www.ribriztravel.com", "/admin/inbox", "", WS), { redirect: `${WS}/admin/inbox` });
  assert.deepEqual(routeHost("ribriztravel.com", "/admin", "?denied=money", WS), { redirect: `${WS}/admin?denied=money` });
  assert.deepEqual(routeHost("www.ribriztravel.com", "/admin/inbox", ""), { pass: true, noindex: false });
  assert.deepEqual(routeHost("www.ribriztravel.com", "/visa", "", WS), { pass: true, noindex: false });
  assert.deepEqual(routeHost("localhost:3200", "/admin", "", WS), { pass: true, noindex: false });
});
