# marathon-coach

- Next.js 16 App Router + TypeScript, Postgres via `postgres` (porsager). No ORM.
- Plan data: `src/lib/plan.ts` (approved Haifa taper from 31 Oct 2026). Don't change approved workouts without the user's approval.
- Rebalance rules: `src/lib/rebalance.ts`. Every rule change needs a test in `rebalance.test.ts`.
- Never store GPS tracks or raw provider payloads. Tokens only via `encrypt()`.
- Integration tests only run against `TEST_DATABASE_URL` on localhost (they delete all rows).
- Before pushing: `npm run typecheck && npm test && npm run check:modern-web && npx next build`.
- UI work (pages, components, CSS): look the pattern up with the Modern Web Guidance skill first (`npx -y modern-web-guidance@latest search "<pattern>"` → `retrieve "<id>"`). `check:modern-web` catches part of it; a false positive goes in `scripts/modern-web-allowlist.json` with a reason.
