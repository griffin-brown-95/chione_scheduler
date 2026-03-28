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

## Current session
- Schema migration