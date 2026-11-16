#!/usr/bin/env node
// Runs the Modern Web Guidance legacy-pattern scan and fails on any finding
// that is not in scripts/modern-web-allowlist.json.
//
// The scan (https://github.com/GoogleChrome/modern-web-guidance) flags web
// platform patterns that have a modern replacement, e.g. ::-webkit-scrollbar
// without scrollbar-color, or an Enter handler that ignores IME composition.
// It covers ~20% of the guidance catalogue (the rules that can be checked
// statically); the rest is applied by Claude through the plugin's skill.
//
// False positive? Check the finding's keepWhen/dropWhen rubric
// (`npx -y modern-web-guidance@<version> legacy-scan . --json`), then add an
// allowlist entry: { "file", "guideId", "match", "reason" }. `match` is a
// substring of the flagged line, so entries survive line-number shifts.
//
// Usage: npm run check:modern-web

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Pinned so CI results only change when we bump it on purpose.
const VERSION = "1.0.0";
const ROOT = new URL("..", import.meta.url).pathname;
const allowlist = JSON.parse(
  readFileSync(new URL("./modern-web-allowlist.json", import.meta.url), "utf8"),
);

let report;
try {
  const out = execFileSync(
    "npx",
    ["-y", `modern-web-guidance@${VERSION}`, "legacy-scan", ROOT, "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 },
  );
  report = JSON.parse(out.slice(out.indexOf("{")));
} catch (err) {
  process.stderr.write(`modern-web scan could not run: ${err.message}\n`);
  process.exit(2);
}

const isAllowed = (guideId, f) =>
  allowlist.some(
    (a) =>
      a.guideId === guideId &&
      a.file === f.file &&
      (!a.match || (f.lineContent || "").includes(a.match)),
  );

const failures = [];
for (const guide of report.guides || []) {
  for (const rule of guide.rules || []) {
    for (const f of rule.findings || []) {
      if (!isAllowed(guide.guideId, f)) failures.push({ guideId: guide.guideId, ...f });
    }
  }
}

if (failures.length === 0) {
  process.stdout.write(
    `modern-web: no new legacy patterns (${report.activeGuideCount ?? "?"} guides checked).\n`,
  );
  process.exit(0);
}

process.stderr.write(`modern-web: ${failures.length} legacy pattern(s) found:\n\n`);
for (const f of failures) {
  process.stderr.write(`  ${f.file}:${f.line}  [${f.guideId}]\n    ${f.message}\n`);
}
process.stderr.write(
  `\nFix with: npx -y modern-web-guidance@${VERSION} retrieve "<guideId>"\n` +
    "If it's a false positive, add it to scripts/modern-web-allowlist.json with a reason.\n",
);
process.exit(1);
