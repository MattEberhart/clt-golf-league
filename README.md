# Queen City Match Play

A small site for a six-team, twelve-player Charlotte-area golf league. Net match
play, one course per month, head-to-head, with a championship round in October.

Built as a personal project — short-lived data, low traffic, but designed to feel
hand-built rather than like a generic dashboard.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** (theme tokens via `@theme inline`)
- **Drizzle ORM** + **Turso** (libSQL / SQLite — works locally as a file)
- **Zod** for input validation
- **jose** for HMAC-signed session cookies
- **date-fns** + **date-fns-tz** for date handling in `America/New_York`
- **pnpm**

Server Components by default. Client components are limited to the password form
and the matchup-filtered submit form. All mutations go through Server Actions.

## Setup

```sh
pnpm install
cp .env.example .env.local
# fill in LEAGUE_PASSWORD and SESSION_SECRET (any 32+ char random string)

pnpm db:generate      # generate migrations from src/db/schema.ts
pnpm db:migrate       # apply migrations (works against file: or libsql: URLs)
pnpm db:seed          # load teams, schedule, matchups, and 2 existing R1 results

pnpm dev              # http://localhost:3000
```

Local dev uses a SQLite file at `./local.db` (configured in `.env.example`).

## Environment variables

| Var | What |
| --- | --- |
| `TURSO_DATABASE_URL` | `file:./local.db` for dev, `libsql://…` for Turso in prod |
| `TURSO_AUTH_TOKEN` | Empty for local file URLs; required for hosted Turso |
| `LEAGUE_PASSWORD` | Shared password league members type to unlock the submit form |
| `SESSION_SECRET` | 32+ random bytes used to sign the cookie. `openssl rand -base64 48` |

All env reads happen inside `server-only` modules (`src/db/client.ts`,
`src/lib/auth.ts`). Nothing is exposed to the client.

## Database scripts

| Script | What |
| --- | --- |
| `pnpm db:generate` | Regenerate `drizzle/*.sql` after editing `src/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations (uses `drizzle-orm/libsql/migrator`) |
| `pnpm db:seed` | Idempotent — exits early if Team #1 already exists |
| `pnpm db:push` | (rarely used) Push schema directly without a migration file |
| `pnpm db:studio` | Drizzle Studio (requires Turso auth token) |

The custom migration runner at `src/db/migrate.ts` is used instead of
`drizzle-kit migrate` so it works for both local file URLs and hosted Turso
(drizzle-kit's `turso` dialect requires an auth token even for `file:` URLs).

## Deploy to Vercel + Turso

1. **Create a Turso DB**
   ```sh
   turso db create clt-golf
   turso db show clt-golf --url            # → TURSO_DATABASE_URL
   turso db tokens create clt-golf         # → TURSO_AUTH_TOKEN
   ```
2. **Apply migrations against Turso**
   ```sh
   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… pnpm db:migrate
   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… pnpm db:seed
   ```
3. **Push to Vercel**, then in the project's Environment Variables set:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `LEAGUE_PASSWORD`
   - `SESSION_SECRET`
4. Deploy. Set `pnpm` as the package manager in Vercel's project settings if
   it's not auto-detected.

## App tour

| Route | What |
| --- | --- |
| `/` | Hero, current round callout, top-6 standings, last 3 results |
| `/schedule` | Full season + championship row (auto-seeds after Round 5) |
| `/standings` | Sortable (`?sort=…`) table with tiebreaker footnote |
| `/teams` | Per-team card with both players, handicaps, and match history |
| `/results` | All results grouped by round, newest first |
| `/submit` | Password gate + form to enter a matchup result |

Submitting a result calls `revalidatePath` on every page that consumes results.

## Tiebreakers

Standings (and championship seeding) apply this chain in order:

1. **Wins** (descending)
2. **Head-to-head** between the tied teams. Two-team tie → direct match winner.
   Three-or-more tie → mini-table of W-L among only those teams.
3. **Cumulative MoV** (sum of holes-up across all wins, descending)
4. **Team #** ascending — deterministic placeholder. A real tiebreaker would
   require a playoff; the README is the canonical place that says so.

Implemented in `src/lib/standings.ts` as `rankTeams(teams, results)`. Pure
function — easy to unit-test (no tests written; spec said to keep them
test-friendly only).

## Championship round

After all three Round 5 matchups have results, the next page load triggers
`reseedChampIfNeeded`, which:

- Computes seeds via `rankTeams`.
- Inserts three matchups under the `champ` round:
  - Slot 1 — Championship (#1 vs #2)
  - Slot 2 — 3rd-place match (#3 vs #4)
  - Slot 3 — Consolation (#5 vs #6)
- Idempotent: if any champ matchups already exist, it does nothing.

Until then, the Championship row on `/schedule` reads "TBD — seeded after Round 5."

## Decisions made

The brief said "make a reasonable call and note it." Notes:

- **Next 16, not Next 15.** `pnpm create next-app@latest` gave Next 16 (released
  late 2025). App Router and Server Actions APIs are unchanged.
- **Accent color: muted teal `#3A7D7B`** (over mustard). Pairs more cleanly
  with walnut + cream and reads better on a golf site without competing with
  course greens.
- **No `/admin` route built.** The brief flagged it as optional. The submit
  form rejects double-entry and surfaces a clear error; data-correction can
  happen via Drizzle Studio for now (`pnpm db:studio`).
- **Custom migration runner.** Drizzle-kit's `turso` dialect requires an
  auth token even when the URL is `file:./local.db`. Using
  `drizzle-orm/libsql/migrator` directly avoids the friction.
- **Session = single-claim JWT in an HttpOnly cookie**, signed with HS256.
  Verified per request via `jose`. No DB session table.
- **Player handicaps stored as TEXT for raw values** because the spec showed
  one-decimal precision (`23.5`, `2.8`); SQLite REAL would round-trip fine but
  TEXT preserves the exact spec representation. Adjusted handicaps are integers.
- **Round 5 venue ("Birkdale, may change") is stored in `courses.notes`** so
  the schedule page can render the parenthetical without hard-coding.
- **`submitted_at` is an ISO string in UTC.** Display formatting happens in
  `America/New_York` via `date-fns` `format`. Round windows are stored as
  date-only strings and compared lexicographically.
- **`force-dynamic`** on data pages. The site is small and traffic is tiny;
  always-fresh reads are cheaper than reasoning about cache invalidation.
- **Champ matchups are seeded server-side on page load**, not via a cron or
  webhook. The brief allowed "on-page-load logic" and that's the simplest
  thing that works given the traffic pattern.

## What's intentionally out

Per the brief: no avatars, no notifications, no live scoring, no per-hole
scorecards, no stroke play, no per-course breakdowns, no h2h page, no public
submission queue, no dark mode.
