// Installs a git pre-push hook that runs the type check, unit tests and browser tests,
// so nothing reaches Vercel (which deploys on push) unless they pass.
// Run once: npm run hooks   ·   Skip in an emergency: git push --no-verify
import { chmodSync, writeFileSync } from "node:fs";
writeFileSync(".git/hooks/pre-push", "#!/bin/sh\necho 'Checking before deploy: types, unit tests, browser tests…'\nnpm run check || { echo '\\n✗ Checks failed: nothing was pushed. Fix them, or push with --no-verify in an emergency.'; exit 1; }\n");
chmodSync(".git/hooks/pre-push", 0o755);
console.log("✓ pre-push hook installed: every git push now runs npm run check first.");
