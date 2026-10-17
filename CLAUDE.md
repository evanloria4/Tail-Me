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
- Post model: Post -> Bet[] -> BetLeg[]. Straight/parlay = 1 bet; ladder = 1 single-leg bet per rung (same pick, climbing lines). Units on bets; straight/parlay slips show "$10 pays $X" (`payout(10, decimalOdds)`; $0 once lost, $10 back on push/void). Ladders show payouts in the poster's units plus an "N/M hit" count. Parlay `americanOdds` may be the book's slip price (same-game parlays) instead of multiplied legs.
- Users settle their own bets (no auto-settlement). One shared feed.
- Stats (`src/shared/stats.ts`, served by `GET /api/users/:username?range=7d|30d|all`) count bets: straight/parlay = 1, every ladder rung is its own W/L. Voids don't count. Multi-league parlays count overall and per type but under no league. Pushes don't break streaks; current streak ignores the date range. Computed in memory per request (fine at friend-group size).
- Profiles live at `/u/:username`: date range is the only filter; per-type / per-league / tailing stats are compact rows in a sticky side column on `lg` (above the slips on smaller screens). `AppLayout` main is `max-w-5xl`; each page sets its own column width (feed = `max-w-2xl`). `GET /api/posts?author=&range=` feeds their slip list. `PATCH /api/me` edits name + bio (username is fixed).
- Social (`routes/social.ts`, mounted at `/api`): `GET /posts/:id/tails` (who tailed, once per person), `POST /posts/:id/reactions {emoji}` toggles (fixed set in `shared/social.ts`), comments `GET/POST /posts/:id/comments`, `DELETE /comments/:id` (own, or admin), `PUT /comments/:id/vote {value: 1|-1|0}` (`CommentVote` table). Free users can do all of it.
- Badges (`shared/badges.ts`): poster streak chip at W3+ (`FeedPost.author.streak`, all-time), gold "cashed" treatment for wins at +400 or longer and clean ladder sweeps, "Crowd pick" at 3+ tails. Thresholds live there. Settling returns the updated `FeedPost` so streaks refresh.
- Feed sidebar (`GET /api/community?tz=&month=YYYY-MM`, `lg` only): "Who's hot" (W3+ streaks), top 3 earners over 7 days (only people up units), month calendar of group net units by post day in the viewer's time zone.
- Group parlays (`GROUP_PARLAY` post, one Bet): each person adds one leg (`BetLeg.addedById`, unique per bet) via `POST /posts/:id/legs` until `Post.lockAt` passes or the creator hits `POST /posts/:id/lock` (needs 2+ legs). Legs come from the live picker only (one book). The creator can tick "This game only" (`Post.groupEventId` / `groupEventLabel`, from their leg); joins must match that event id; the picker opens straight into that game with no way back to other games (the server check is the fail-safe). Same-game group parlays show the legs multiplied as "est." until the creator enters the book's price after lock (`PUT /posts/:id/price`); `hasBookPrice` tells them apart (legs are fixed once locked). Once locked anyone, creator included, can place it (the tail route). Legs are graded one by one (`PATCH /posts/legs/:legId`, owner or creator); `groupResult` derives the bet. They never count toward personal stats, streaks, earners or the calendar (`PostType` in `shared/stats.ts` excludes them; filter with `POST_TYPES` / `isPersonalType`). The sidebar shows the group record and each person's legs hit / busted. Adding legs needs a subscription; placing doesn't.
- Tails are never shown on the tailer's profile; tracked for tail counts and per-poster tail records.
- Leagues: NFL, NCAA Football, NHL. Books: DraftKings, FanDuel, BetMGM, Caesars (`williamhill_us`), Fanatics, ESPN BET — stored in tables (seed in `prisma/seed.ts`).
- Only `SUPABASE_URL` and `SUPABASE_ANON_KEY` reach the browser (webpack DefinePlugin). Never import `src/server/*` from client code.

## Gotchas
- Prisma 7: migrations use `DIRECT_URL` (port 5432); runtime uses `DATABASE_URL` via `@prisma/adapter-pg` (`src/server/db.ts`). `migrate dev` doesn't auto-generate, hence the script. If `migrate dev` hangs, use `--create-only` then `prisma migrate deploy`. It also refuses to run non-interactively when a migration needs a confirmation (e.g. a new unique index); then write the SQL with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` into a new migration folder and `migrate deploy` it.
- npm `latest` for Prisma is an 8.x RC — stay on 7.10.0 until 8 is stable.
- The init migration revokes `anon`/`authenticated` access to `public` tables (keeps them off Supabase's Data API). Keep it that way; all data access goes through Express.
- Rewrite generated migrations that drop+add a column into a `RENAME` when renaming.
- ts-node uses a CommonJS override in `tsconfig.json`; client uses ESNext/bundler resolution.
- Webpack cleans only its own outputs in `dist/` — tsc's `dist/server`, `dist/shared`, `dist/generated` must survive.
- helmet CSP allows the Supabase URL for `connect-src`/`img-src`; add any new external origins there.
- Windows dev machine (CRLF); Prettier uses `endOfLine: 'auto'`.

## Live odds (bet picker)
- `src/server/odds.ts` wraps The Odds API with an in-memory TTL cache; routes in `routes/odds.ts` (subscribers only). Market whitelist + labels live in `src/shared/markets.ts`.
- Live odds come from FanDuel only for now (`LIVE_ODDS_BOOK` in `shared/markets.ts`); the picker says so. Adding books costs nothing extra (≤10 books in one call = one region). Every slip comes from the picker (the typed-in form was removed), so FanDuel is the only book until more are added.
- In development (`nodemon.json` sets `NODE_ENV=development`) odds cache for 24h and persist to `.cache/odds/` (gitignored) so restarts don't spend credits; delete that folder to force fresh odds. nodemon only watches `src/server` and `src/shared`.
- Credits are scarce (shared key): in production game lines cache 5 min per league, props/alt lines cache 10 min per market and load one category at a time. Don't add eager or background fetches.
- Picked legs store `eventId`, `bookSelectionId` and the book's add-to-betslip `deepLink`; straight bets and ladder rungs also set `Bet.deepLink`. Older typed-in slips (no `eventId`/`deepLink`) still render; Tail sends them to the book's homepage. The server still accepts legs without links.

## Not built yet
Avatars/headshots (Supabase Storage), Stripe ($5/mo), password reset (needs Resend SMTP + domain), deploy (planned: DigitalOcean App Platform).
