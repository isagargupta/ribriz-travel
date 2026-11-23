// Puts the Supabase database password and secret key into .env without showing them.
// Run:  node scripts/set-secrets.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { stdin, stdout } from "node:process";

function ask(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n") { stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); stdout.write("\n"); resolve(value.trim()); }
      else if (ch === "\u0003") { stdout.write("\nCancelled.\n"); process.exit(1); }
      else if (ch === "\u007f") { if (value) { value = value.slice(0, -1); stdout.write("\b \b"); } }
      else { value += ch; stdout.write("*".repeat(ch.length)); }
    };
    stdin.on("data", onData);
  });
}

let env = readFileSync(".env", "utf8");

if (env.includes("[YOUR-PASSWORD]")) {
  const pw = await ask("Supabase database password (hidden): ");
  if (!pw) { console.log("No password entered, nothing changed."); process.exit(1); }
  env = env.replaceAll("[YOUR-PASSWORD]", encodeURIComponent(pw));
  console.log("✓ Password added to DATABASE_URL and DIRECT_URL");
} else {
  console.log("✓ Database password already set");
}

const cur = (env.match(/^SUPABASE_SECRET_KEY="?([^"\n]*)"?$/m) || [])[1] || "";
if (!cur.startsWith("sb_secret_") && !cur.startsWith("eyJ")) {
  const key = await ask("Supabase secret key, starts with sb_secret_ (hidden, Enter to skip): ");
  if (key && !key.startsWith("sb_secret_") && !key.startsWith("eyJ")) {
    console.log("That doesn't look like a secret key (it should start with sb_secret_). Skipped.");
  } else if (key) {
    env = env.replace(/^SUPABASE_SECRET_KEY=.*$/m, `SUPABASE_SECRET_KEY="${key}"`);
    console.log("✓ Secret key added");
  } else console.log("Skipped secret key (photo uploads will not work until it is set).");
} else {
  console.log("✓ Secret key already set");
}

writeFileSync(".env", env);
console.log("Saved .env. Go back to Claude and say done.");
