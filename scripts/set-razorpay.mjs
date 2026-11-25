// Sets Razorpay keys without showing them, locally and (for live keys) on Vercel.
//   Test keys (rzp_test_…) → .env.local only, so just this computer uses them.
//   Live keys (rzp_live_…) → .env and Vercel production.
// Optionally makes a new webhook secret and prints it once, for Razorpay's dashboard.
// Run:  node scripts/set-razorpay.mjs
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { stdin, stdout } from "node:process";

function ask(question, hidden = true) {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = "";
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n") { stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); stdout.write("\n"); resolve(value.trim()); }
      else if (ch === "\u0003") { stdout.write("\nCancelled.\n"); process.exit(1); }
      else if (ch === "\u007f") { if (value) { value = value.slice(0, -1); stdout.write("\b \b"); } }
      else { value += ch; stdout.write(hidden ? "*".repeat(ch.length) : ch); }
    };
    stdin.on("data", onData);
  });
}

const setVar = (text, name, value) => (new RegExp(`^${name}=`, "m").test(text) ? text.replace(new RegExp(`^${name}=.*$`, "m"), `${name}="${value}"`) : `${text.replace(/\n*$/, "\n")}${name}="${value}"\n`);
const dropVar = (text, name) => text.replace(new RegExp(`^${name}=.*\\n?`, "m"), "");

function vercelSet(name, value) {
  spawnSync("npx", ["vercel", "env", "rm", name, "production", "--confirm-name", name, "--yes"], { stdio: "ignore" });
  const r = spawnSync("npx", ["vercel", "env", "add", name, "production", "--sensitive"], { input: value, stdio: ["pipe", "ignore", "pipe"] });
  console.log(r.status === 0 ? `✓ ${name} updated on Vercel` : `✗ Couldn't update ${name} on Vercel: ${String(r.stderr).split("\n")[0]}`);
}

const id = await ask("Razorpay Key ID (rzp_test_… or rzp_live_…): ", false);
const mode = id.startsWith("rzp_test_") ? "test" : id.startsWith("rzp_live_") ? "live" : null;
if (!mode) { console.log("That doesn't look like a Razorpay Key ID. Nothing changed."); process.exit(1); }
const secret = await ask("Key Secret (hidden): ");
if (secret.length < 10) { console.log("That secret looks too short. Nothing changed."); process.exit(1); }

if (mode === "test") {
  let local = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
  local = setVar(setVar(local, "RAZORPAY_KEY_ID", id), "RAZORPAY_KEY_SECRET", secret);
  writeFileSync(".env.local", local);
  console.log("✓ Test keys saved to .env.local (this computer only; the live site keeps its live keys).");
} else {
  let env = readFileSync(".env", "utf8");
  env = setVar(setVar(env, "RAZORPAY_LIVE_API_KEY", id), "RAZORPAY_LIVE_KEY_SECRET", secret);
  writeFileSync(".env", env);
  console.log("✓ Live keys saved to .env");
  vercelSet("RAZORPAY_KEY_ID", id);
  vercelSet("RAZORPAY_KEY_SECRET", secret);
  // a stale test key in .env.local would override the new live one on this computer
  if (existsSync(".env.local")) writeFileSync(".env.local", dropVar(dropVar(readFileSync(".env.local", "utf8"), "RAZORPAY_KEY_ID"), "RAZORPAY_KEY_SECRET"));

  const again = await ask("Make a new webhook secret too? (y/n): ", false);
  if (again.toLowerCase().startsWith("y")) {
    const wh = randomBytes(24).toString("base64url");
    writeFileSync(".env", setVar(readFileSync(".env", "utf8"), "RAZORPAY_WEBHOOK_SECRET", wh));
    vercelSet("RAZORPAY_WEBHOOK_SECRET", wh);
    console.log(`\nNew webhook secret (paste it into Razorpay → Webhooks → your webhook → Secret, then clear this screen):\n\n  ${wh}\n`);
  }
  console.log("Push or redeploy so the live site picks up the new keys, or tell Claude 'done'.");
}
console.log("Done. Go back to Claude and say done.");
