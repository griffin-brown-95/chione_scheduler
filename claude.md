# Olympic Park Lane Management — Project Context

## What this is
A facility scheduling and invoicing app for Utah Olympic Park (Park City, Utah).
Manages lane reservations across ski jumping, sliding, and rink facilities.
Replaces a Google Sheet. External consumers include video boards and monthly invoicing.

## Stack
- Next.js (App Router)
- Supabase (Postgres + Auth + RLS)
- Tailwind CSS
- Deployed on Vercel

## Current state
- Working HTML prototype in /prototype/index.html
- Schema migration in progress (feature/schema branch)

## Data model decisions already made
- Pricing rates are versioned with effective_from / effective_to dates
  so historical bookings are never affected by rate changes
- Seasonal availability is modeled on spaces/lanes, not bookings
- Grooming schedules are a separate table, not a booking type
- Rink uses continuous 15-min increment billing (space_type = 'continuous')
  rather than fixed time blocks
- RLS enforced at DB level — team users see only their team's data

## User roles
- admin: full access, can invite users, manage all entities
- team: scoped to their team_id, read-only on other teams' bookings

## Key external consumers (GET APIs are highest priority)
- Video boards: need today's schedule in a single fast call
- Monthly invoicing: need rollup by team/space/date range
- Future: mobile app

## Features in scope
- Versioned pricing rates
- Seasonal pricing (low priority)
- Team-level discounts
- Grooming schedules
- Calendar view toggle + space filtering
- Automatic seasonal date filtering (pool hidden in winter, etc.)
- Rink scheduling (15-min increments, different billing)
- Email invites via Supabase Auth
- REST API for all backend entities

## Features out of scope (for now)
- Payment processing
- Public booking page
- Mobile app

## Conventions
- All migrations in /supabase/migrations/
- API routes in /app/api/
- Use snake_case for DB columns, camelCase in JS
- Never mutate a rate record — insert a new one with effective_from date

## Completed
- Scaffold: Next.js + Supabase + Tailwind ✓
- Auth: Supabase Auth + invite flow + RLS ✓
- Schema: full migration with versioned rates, RLS, indexes ✓
- GET API routes: schedule, bookings, invoices, reference data ✓

## API conventions (important — follow these in all future routes)
- Response envelope: `{ data, error, meta }` via `ok()`, `err()` etc in `src/lib/api/response.ts`
- Auth: use `getAuthContext()` / `getAdminContext()` from `src/lib/api/auth.ts`
- Service role client in `src/lib/supabase/service.ts` for public endpoints only
- Schedule logic lives in `app/api/_lib/schedule.ts` — reuse `buildSchedule()`
- TypeScript types for all response shapes in `src/lib/api/types.ts`

## Database functions (do not recreate these in app code)
- `create_booking()` — atomic conflict check + insert, raises P0001/P0002
- `rotate_pricing_rate()` — closes old rate, inserts new one, raises P0003

## API conventions (updated)
- Auth: use `getAuthContext()` + explicit role check for admin routes
  — never use `getAdminContext()` in write routes
  — authenticated non-admins should receive 403, not 401
- Shared select strings: `BOOKING_SELECT`, `GROUP_SELECT` in `src/app/api/_lib/bookings.ts`
- Shared constants: `TEAM_STATUSES`, `USER_ROLES` in `src/lib/api/constants.ts`
- When fetching a lane + its space, use a single joined query with embed
  — never two sequential fetches
- Grooming POST: lane_id presence implicitly validates space — skip separate space check

## Routing structure
- All authenticated pages live in src/app/(app)/
- Auth pages live in src/app/(auth)/
- Never create pages at src/app/[page]/page.tsx — they won't have the auth guard

## Frontend progress
### Completed pages
- `/dashboard` — server component, admin + team views, stats + recent bookings
- `/bookings` — admin only, filterable + paginated, ViewBookingModal reused
- `/my-bookings` — team only, scoped to team_id, ViewBookingModal reused

### Completed components
- `components/Sidebar.tsx` — role-aware nav, sign-out
- `components/Toast.tsx` — ToastProvider + useToast() hook
- `components/ViewBookingModal.tsx` — reusable, accepts role + myTeamId props

### Remaining pages
- `/builder` — not started  
- `/teams` — not started (invite flow lives here)
- `/groups` — not started
- `/invoicing` — not started

### Routing rules
- All authenticated pages in src/app/(app)/ — auth guard applies automatically
- Auth pages in src/app/(auth)/
- Never create pages at src/app/[page]/page.tsx

### Component reuse rules
- ViewBookingModal is already built — import and reuse, never recreate it
- useToast() hook is available everywhere via ToastProvider in root layout
- Always check existing components before creating new ones