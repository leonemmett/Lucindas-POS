# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Lucinda's POS — a point-of-sale app for a gelato/coffee/bistro shop (menu ordering, tables, till cashups, sales reporting, inventory). React + TypeScript + Vite frontend with Supabase (Postgres + Auth + RLS) as the only backend — there is no separate API server; the client talks to Supabase directly via `@supabase/supabase-js`.

Deployed on Vercel (project already linked; auto-deploys on push to `main` via the GitHub integration). Live at the Vercel project domain.

## Commands

```
npm run dev       # start Vite dev server
npm run build     # tsc -b (typecheck) && vite build
npm run lint      # oxlint
npm run preview   # preview a production build
```

There is no test suite (no test runner configured, no `*.test.*`/`*.spec.*` files). Verify changes by running `npm run build` (catches type errors) and driving the app manually.

### Database (Supabase)

The project is linked via the Supabase CLI (`supabase link --project-ref <ref>`, needs `supabase login` once). Migrations live in `supabase/migrations/*.sql` and are applied directly to the hosted project — there's no local Docker/Supabase stack in the normal workflow.

```
npx supabase migration list        # see which migrations are applied locally vs remote
npx supabase db push --linked --yes   # apply new migration files to the remote database
```

When writing a new migration, add a timestamped file (`date -u +%Y%m%d%H%M%S`) rather than editing an old one — old migrations are historical record, not idempotent scripts to rerun.

### Env vars (`.env.local`, gitignored)

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_COUNTER_EMAIL       # shared walk-up account, see Auth model below
VITE_COUNTER_PASSWORD
```

All `VITE_`-prefixed vars are inlined into the client bundle at build time and are visible to anyone — this is expected, not a leak (the anon key and Counter credentials are meant to be public; real access control is enforced by Postgres RLS, not by hiding these values).

## Auth model

Two kinds of session, both real Supabase Auth accounts — there's no separate "guest mode":

- **Counter session**: a shared account the app silently signs into (`AuthContext.tsx`) whenever no session exists, so the POS works with no login screen for walk-up use. Detected via `isCounterSession = session.user.email === VITE_COUNTER_EMAIL`. Shows only the POS tab, plus a "Staff sign in" button that opens a login overlay without disturbing the counter session underneath.
- **Staff session**: a real staff member's own login. Nav access is gated in `App.tsx` by `isCounterSession` and `staff.is_admin` (looked up via `useCurrentStaff`, matched by JWT email): non-admin staff get POS/Tables/Cashup; Menu/Ingredients/Low stock/Reports/Staff/Settings require `is_admin`.

Signing out returns to the Counter session automatically (never a blank login page). The Counter sign-in retries once on failure since a cold first request can occasionally hiccup.

## RLS model — read this before touching policies

Most tables (`tables`, `ingredients`, `menu_items`, `open_tickets`, `cashups`, `settings`) intentionally grant full CRUD to any `authenticated` session, including the Counter account — the client's `isAdmin`/`isCounterSession` checks are the real UX gate for those, not a security boundary. Two tables are different and are the real enforcement points:

- **`sales`**: SELECT/UPDATE restricted to admins (checked via `staff.is_admin` matched on `auth.jwt() ->> 'email'`). INSERT is open to any authenticated session, but only through the `record_sale` RPC.
- **`staff`**: INSERT/UPDATE/DELETE restricted to admins; SELECT allows reading your own row or, if admin, everyone's. This exists because a blanket-open policy here would let the public Counter session grant itself `is_admin = true` and unlock everything else — found and fixed via security review (see migrations `20260706142205`/`20260706142524`).

**Do not write a self-referential RLS policy that queries `staff` from within a policy on `staff` itself** — Postgres raises "infinite recursion detected in policy" and breaks all access to the table. Use the `is_current_user_admin()` SQL function (`SECURITY DEFINER`, bypasses RLS internally) instead, the same pattern `get_daily_sales_totals()` and `get_item_popularity()` use to expose safe aggregates without opening up the underlying admin-only tables.

## Sales / inventory deduction

`record_sale(...)` (a Postgres function, not client-side logic) inserts the sale and decrements ingredient stock in one transaction, so a dropped connection mid-checkout can't corrupt stock counts. For each line item it decrements: the item's `container_id` ingredient by qty, each `recipe` entry by qty × recipe-qty, and each selected `flavors` entry by qty × grams. Stock is allowed to go negative (a restock signal, not a hard block). `void_sale` (admin-only RPC) reverses all of that and soft-deletes the sale (`voided_at`/`void_reason`/`voided_by`) — sales are never hard-deleted.

Menu items come in three shapes, distinguished by their own fields rather than a type column:
- Fixed-recipe items (drinks, bakery) — `recipe` alone determines deduction.
- Scoop-based gelato (`ball_count > 0`) — flavor(s) chosen per sale in `FlavorPickerModal`, not baked into the recipe; `grams_per_ball` (a `settings` row, `useGramsPerBall`) drives how many grams one scoop deducts.
- Weight-based tubs (`weight_grams > 0`, e.g. 400g/750g/1kg) — that weight is split evenly across however many flavors were chosen.

## Data fetching pattern

Every `src/hooks/use*.ts` follows the same shape: local `data`/`loading`/`error` state, a `load` function via `useCallback`, `useEffect(() => { load() }, [load])` for the initial fetch, and `{ data, loading, error, refetch: load }` returned. There's no global store — `App.tsx` calls most of these hooks directly and passes the results down as props. If you add a data hook, match this shape so error/retry handling stays consistent (see the retry-button UI in `MenuGrid`/`IngredientManager`/etc.).

`App.tsx` also refetches all core data hooks whenever the signed-in identity changes (`sessionUserId` effect) — this exists because each hook's initial fetch fires on mount independent of auth state, and on a cold visit the Counter sign-in (a real network round-trip) can resolve after that first fetch already ran and got an empty, unauthenticated result that would otherwise never retry.

## Favourites tab

Membership is the union of an automatic rule and a manual flag: `isFavourite()` in `MenuGrid.tsx` matches the whole Coffee category, Bakery items named "Cookie*", and specific Gelato scoop/weight name patterns (via regex — deliberately excludes named specialty items like "Affogato" or "CONO DULCE DE LECHE" that also live in Gelato); `menu_items.is_favourite` lets any item be pinned in manually (toggle in `MenuManager`, checkbox in `MenuItemEditor`). The tab sorts by real sales volume via `get_item_popularity()` (a `SECURITY DEFINER` RPC returning only aggregate qty-sold-per-item, since raw `sales` rows are admin-only) — items with no sales yet fall back to alphabetical order.

## CSV import/export

`src/lib/csv.ts` is a small hand-rolled parser/serializer (no dependency) — reuse it rather than adding a CSV library. Upload (Ingredients, Menu items) matches existing rows by name (case-insensitive): updates if found, inserts if not, and reports per-row errors rather than failing the whole batch. Menu item CSVs deliberately exclude recipes — those stay edited one item at a time in the app's own editor.

## Conventions

- Currency is always MXN: `new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })`, repeated per-component rather than shared — match it when formatting money anywhere new.
- Tables are named "Table N" (`lib/constants.ts`, `MAX_TABLES = 8`), enforced unique at the DB level; don't reintroduce free-text table names.
- CSS is a single `src/App.css` (plus `src/index.css` for the `:root` theme variables) using CSS custom properties for theming (`--accent`, `--bg`, `--surface`, etc., with a `@media (prefers-color-scheme: dark)` override block) — no CSS-in-JS, no Tailwind.
