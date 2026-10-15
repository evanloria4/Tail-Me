# Tail-Me

Social sports-betting app for one friend group: users post straight / parlay / ladder slips, friends view and "tail" them (open the poster's sportsbook with the bet prefilled). $5/mo subscription (Stripe, not built yet) pays for The Odds API.

## Stack
- Client: React 19 + TypeScript, react-router 7, Tailwind 3, bundled by webpack + Babel (`src/client`)
- Server: Express 5 (`src/server`), compiled by `tsc -p tsconfig.prod.json` to `dist/server`
- Shared: `src/shared` — odds math (`odds.ts`) and zod post schemas/types (`posts.ts`), used by both client and server
- DB: Supabase Postgres via **Prisma 7** (`prisma/schema.prisma`, config in `prisma.config.ts`, client generated to `src/generated/prisma`, gitignored)
- Auth: Supabase Auth; images will use Supabase Storage

## Commands
- `npm run start:dev` — API on :8080 (nodemon + ts-node); `npm run dev` — client on :4000, proxies `/api` to :8080
- `npm run prod` — build server + client, serve both from :8080
- `npm test` (vitest), `npm run typecheck`, `npm run lint`
- `npm run db:migrate` (migrate dev + generate), `db:deploy`, `db:seed`, `db:studio`
- `npm run db:demo` — fake friends + slips for UI work (re-runnable; `-- --clear` removes them)
- `npm run admin:set -- <username> [true|false]`, `npm run dev:subscribe -- <username> [ACTIVE|NONE]`

## Rules & decisions
- Paywall: free users can view + tail. Posting and anything that hits the Odds API require `requireSubscription` (admins pass). Client mirrors this with `useAuth().isSubscribed`.
- Signup is server-side only (`POST /api/auth/signup`) so the shared `SIGNUP_PASSCODE` can't be skipped; Supabase public signups are meant to be disabled.
- API auth: client sends Supabase access token as `Authorization: Bearer`; `requireAuth` verifies it and loads the Prisma `User` into `req.user`.
- Users have required `fullName` + unique `username`; show both.
- Post model: Post -> Bet[] -> BetLeg[]. Straight/parlay = 1 bet; ladder = 1 single-leg bet per rung (same pick, climbing lines). Units on bets; every slip shows "$10 pays $X" (`payout(10, decimalOdds)`). Parlay `americanOdds` may be the book's slip price (same-game parlays) instead of multiplied legs.
- Users settle their own bets (no auto-settlement). One shared feed.
- Tails are never shown on the tailer's profile; tracked for tail counts and per-poster tail records.
- Leagues: NFL, NCAA Football, NHL. Books: DraftKings, FanDuel, BetMGM, Caesars (`williamhill_us`), Fanatics, ESPN BET — stored in tables (seed in `prisma/seed.ts`).
- Only `SUPABASE_URL` and `SUPABASE_ANON_KEY` reach the browser (webpack DefinePlugin). Never import `src/server/*` from client code.

## Gotchas
- Prisma 7: migrations use `DIRECT_URL` (port 5432); runtime uses `DATABASE_URL` via `@prisma/adapter-pg` (`src/server/db.ts`). `migrate dev` doesn't auto-generate, hence the script. If `migrate dev` hangs, use `--create-only` then `prisma migrate deploy`.
- npm `latest` for Prisma is an 8.x RC — stay on 7.10.0 until 8 is stable.
- The init migration revokes `anon`/`authenticated` access to `public` tables (keeps them off Supabase's Data API). Keep it that way; all data access goes through Express.
- Rewrite generated migrations that drop+add a column into a `RENAME` when renaming.
- ts-node uses a CommonJS override in `tsconfig.json`; client uses ESNext/bundler resolution.
- Webpack cleans only its own outputs in `dist/` — tsc's `dist/server`, `dist/shared`, `dist/generated` must survive.
- helmet CSP allows the Supabase URL for `connect-src`/`img-src`; add any new external origins there.
- Windows dev machine (CRLF); Prettier uses `endOfLine: 'auto'`.

## Not built yet
Odds API integration (live odds picker, cached events, deep links via `includeLinks`/`includeSids`), Tail button + tail records, profile pages, avatars/headshots (Supabase Storage), Stripe ($5/mo), password reset (needs Resend SMTP + domain), deploy (planned: DigitalOcean App Platform).
