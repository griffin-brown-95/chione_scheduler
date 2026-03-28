-- =============================================================================
-- Chione Scheduler — Initial Schema
-- Migration: 20250327000000_init_schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()


-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- Distinguishes how time is sold: predefined blocks vs. flexible 15-min rink
CREATE TYPE space_type AS ENUM ('block_scheduled', 'rink');

-- Season a space / lane is operational
CREATE TYPE season_type AS ENUM ('winter', 'summer', 'year_round');

-- Pricing tier — mirrors team residency status in the prototype
CREATE TYPE team_status AS ENUM ('residential', 'local', 'out_of_state', 'international');

-- Booking lifecycle
CREATE TYPE booking_status AS ENUM ('active', 'blocked', 'cancelled');

-- Auth role for app-level permissions
CREATE TYPE user_role AS ENUM ('admin', 'team');


-- ---------------------------------------------------------------------------
-- HELPER FUNCTIONS (used in RLS policies)
-- SECURITY DEFINER so they run as the role that owns the function (postgres),
-- preventing policy recursion on the profiles table.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_team_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.profiles WHERE id = auth.uid();
$$;


-- ---------------------------------------------------------------------------
-- TEAMS
-- ---------------------------------------------------------------------------
CREATE TABLE public.teams (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  status      team_status NOT NULL,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "admin_all_teams" ON public.teams
  FOR ALL TO authenticated USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Team users: read their own team only
CREATE POLICY "team_read_own_team" ON public.teams
  FOR SELECT TO authenticated
  USING (id = public.auth_team_id());

CREATE INDEX idx_teams_active ON public.teams (active);


-- ---------------------------------------------------------------------------
-- PROFILES  (one row per auth.users row)
-- ---------------------------------------------------------------------------
-- Created automatically via trigger on auth.users INSERT.
-- team_id is NULL for admin users.
CREATE TABLE public.profiles (
  id          UUID      PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  team_id     UUID      REFERENCES public.teams (id) ON DELETE SET NULL,
  role        user_role NOT NULL DEFAULT 'team',
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users may always read and update their own profile
CREATE POLICY "own_profile_read" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "own_profile_update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins may read and manage all profiles
CREATE POLICY "admin_all_profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE INDEX idx_profiles_team_id ON public.profiles (team_id);
CREATE INDEX idx_profiles_role    ON public.profiles (role);


-- ---------------------------------------------------------------------------
-- TRIGGER: auto-create profile on new auth user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'team')
  ON CONFLICT (id) DO NOTHING;  -- idempotent; safe on re-runs
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ---------------------------------------------------------------------------
-- GROUPS  (sub-units within a team, e.g. "U16 Girls", "Elite A")
-- ---------------------------------------------------------------------------
CREATE TABLE public.groups (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID    NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_groups" ON public.groups
  FOR ALL TO authenticated USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE POLICY "team_read_own_groups" ON public.groups
  FOR SELECT TO authenticated USING (team_id = public.auth_team_id());

-- Team users may manage their own groups
CREATE POLICY "team_write_own_groups" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (team_id = public.auth_team_id());

CREATE POLICY "team_update_own_groups" ON public.groups
  FOR UPDATE TO authenticated
  USING (team_id = public.auth_team_id())
  WITH CHECK (team_id = public.auth_team_id());

CREATE INDEX idx_groups_team_id ON public.groups (team_id);


-- ---------------------------------------------------------------------------
-- SPACES  (Intermediate Hill, Training Pool, Jump Complex, Ice Rink, …)
-- ---------------------------------------------------------------------------
CREATE TABLE public.spaces (
  id          UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT       NOT NULL,
  space_type  space_type NOT NULL,
  season      season_type NOT NULL,
  active      BOOLEAN    NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

-- Spaces are reference data — all authenticated users can read
CREATE POLICY "authenticated_read_spaces" ON public.spaces
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "admin_write_spaces" ON public.spaces
  FOR ALL TO authenticated USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE INDEX idx_spaces_season ON public.spaces (season);
CREATE INDEX idx_spaces_active ON public.spaces (active);


-- ---------------------------------------------------------------------------
-- LANES  (individual lanes / tracks within a space)
-- ---------------------------------------------------------------------------
CREATE TABLE public.lanes (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    UUID    NOT NULL REFERENCES public.spaces (id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  sort_order  INT     NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lanes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_lanes" ON public.lanes
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "admin_write_lanes" ON public.lanes
  FOR ALL TO authenticated USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE INDEX idx_lanes_space_id ON public.lanes (space_id);
CREATE INDEX idx_lanes_active   ON public.lanes (active);


-- ---------------------------------------------------------------------------
-- LANE AVAILABILITY  (seasonal on/off per lane)
-- One row per (lane, season). The calendar uses the current date's season to
-- decide which lanes to show. A missing row is treated as "unavailable".
-- ---------------------------------------------------------------------------
CREATE TABLE public.lane_availability (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lane_id     UUID        NOT NULL REFERENCES public.lanes (id) ON DELETE CASCADE,
  season      season_type NOT NULL,
  available   BOOLEAN     NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (lane_id, season)   -- one availability record per lane per season
);

ALTER TABLE public.lane_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_lane_availability" ON public.lane_availability
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "admin_write_lane_availability" ON public.lane_availability
  FOR ALL TO authenticated USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE INDEX idx_lane_availability_lane_id ON public.lane_availability (lane_id);
CREATE INDEX idx_lane_availability_season  ON public.lane_availability (season);


-- ---------------------------------------------------------------------------
-- PRICING RATES  (versioned, append-only — never UPDATE a rate row)
-- One active rate per (lane, team_status) at any time, enforced by partial
-- unique index on effective_to IS NULL.
--
-- block_scheduled spaces: use rate_cents_per_slot
-- rink spaces:            use rate_cents_per_15min
-- Both columns exist on every row; only one should be populated based on
-- the parent space's space_type. A CHECK ensures exactly one is set.
-- ---------------------------------------------------------------------------
CREATE TABLE public.pricing_rates (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lane_id               UUID        NOT NULL REFERENCES public.lanes (id) ON DELETE CASCADE,
  team_status           team_status NOT NULL,
  rate_cents_per_slot   INT,        -- for block_scheduled spaces (e.g. 5000 = $50.00)
  rate_cents_per_15min  INT,        -- for rink spaces
  effective_from        DATE        NOT NULL,
  effective_to          DATE,       -- NULL = currently active
  created_by            UUID        REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Exactly one rate column must be set
  CONSTRAINT chk_rate_exactly_one CHECK (
    (rate_cents_per_slot IS NOT NULL AND rate_cents_per_15min IS NULL)
    OR
    (rate_cents_per_slot IS NULL AND rate_cents_per_15min IS NOT NULL)
  ),

  -- No negative rates
  CONSTRAINT chk_rate_slot_positive   CHECK (rate_cents_per_slot   IS NULL OR rate_cents_per_slot   > 0),
  CONSTRAINT chk_rate_15min_positive  CHECK (rate_cents_per_15min  IS NULL OR rate_cents_per_15min  > 0),

  -- effective_to must be after effective_from when set
  CONSTRAINT chk_rate_date_order CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- Enforce at most one open-ended (active) rate per lane+tier
CREATE UNIQUE INDEX uidx_pricing_rates_active
  ON public.pricing_rates (lane_id, team_status)
  WHERE effective_to IS NULL;

ALTER TABLE public.pricing_rates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read rates (needed to display costs)
CREATE POLICY "authenticated_read_pricing_rates" ON public.pricing_rates
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "admin_write_pricing_rates" ON public.pricing_rates
  FOR ALL TO authenticated USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE INDEX idx_pricing_rates_lane_id       ON public.pricing_rates (lane_id);
CREATE INDEX idx_pricing_rates_effective_from ON public.pricing_rates (effective_from);


-- ---------------------------------------------------------------------------
-- TEAM DISCOUNTS  (versioned, append-only — same pattern as pricing_rates)
-- Applied on top of the base rate at booking time.
-- ---------------------------------------------------------------------------
CREATE TABLE public.team_discounts (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID    NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  discount_percent NUMERIC(5,2) NOT NULL,
  description      TEXT,
  effective_from   DATE    NOT NULL,
  effective_to     DATE,   -- NULL = currently active
  created_by       UUID    REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_discount_range  CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT chk_discount_dates  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- At most one active discount per team at a time
CREATE UNIQUE INDEX uidx_team_discounts_active
  ON public.team_discounts (team_id)
  WHERE effective_to IS NULL;

ALTER TABLE public.team_discounts ENABLE ROW LEVEL SECURITY;

-- Team users can read their own discount (useful for showing estimated cost)
CREATE POLICY "team_read_own_discount" ON public.team_discounts
  FOR SELECT TO authenticated
  USING (team_id = public.auth_team_id() OR public.auth_is_admin());

CREATE POLICY "admin_write_team_discounts" ON public.team_discounts
  FOR ALL TO authenticated USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE INDEX idx_team_discounts_team_id ON public.team_discounts (team_id);


-- ---------------------------------------------------------------------------
-- TIME SLOTS  (named, recurring time windows for block_scheduled spaces)
-- Not used by rink spaces — rink bookings carry explicit start/end times.
-- ---------------------------------------------------------------------------
CREATE TABLE public.time_slots (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    UUID    NOT NULL REFERENCES public.spaces (id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,         -- display label, e.g. "7am–9am"
  start_time  TIME    NOT NULL,
  end_time    TIME    NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_slot_time_order CHECK (end_time > start_time)
);

ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_time_slots" ON public.time_slots
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "admin_write_time_slots" ON public.time_slots
  FOR ALL TO authenticated USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE INDEX idx_time_slots_space_id ON public.time_slots (space_id);


-- ---------------------------------------------------------------------------
-- BOOKINGS
-- ---------------------------------------------------------------------------
-- For block_scheduled lanes: slot_id is required; start/end_time come from
--   the time_slots row (denormalized into start_time/end_time for convenience
--   and invoice stability).
-- For rink lanes: slot_id is NULL; start_time/end_time are set explicitly and
--   must align to 15-minute boundaries (enforced by CHECK).
--
-- total_cost_cents is calculated at booking creation and stored here so that
-- future rate changes don't silently alter historical invoices.
-- ---------------------------------------------------------------------------
CREATE TABLE public.bookings (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  lane_id          UUID           NOT NULL REFERENCES public.lanes (id),
  space_id         UUID           NOT NULL REFERENCES public.spaces (id),
  booking_date     DATE           NOT NULL,
  slot_id          UUID           REFERENCES public.time_slots (id) ON DELETE RESTRICT,
  start_time       TIME,          -- required when slot_id IS NULL (rink)
  end_time         TIME,          -- required when slot_id IS NULL (rink)
  team_id          UUID           REFERENCES public.teams (id) ON DELETE RESTRICT,
  group_id         UUID           REFERENCES public.groups (id) ON DELETE SET NULL,
  status           booking_status NOT NULL DEFAULT 'active',
  block_reason     TEXT,          -- populated when status = 'blocked'
  total_cost_cents INT            NOT NULL DEFAULT 0,
  notes            TEXT,
  created_by       UUID           NOT NULL REFERENCES auth.users (id),
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  -- A slot booking or a timed booking, never both or neither
  CONSTRAINT chk_booking_time_mode CHECK (
    (slot_id IS NOT NULL AND start_time IS NULL AND end_time IS NULL)
    OR
    (slot_id IS NULL AND start_time IS NOT NULL AND end_time IS NOT NULL)
  ),

  -- Rink times must end after start
  CONSTRAINT chk_booking_time_order CHECK (
    start_time IS NULL OR end_time > start_time
  ),

  -- Rink bookings must align to 15-minute boundaries
  CONSTRAINT chk_booking_15min_start CHECK (
    start_time IS NULL
    OR EXTRACT(MINUTE FROM start_time)::INT % 15 = 0
  ),
  CONSTRAINT chk_booking_15min_end CHECK (
    end_time IS NULL
    OR EXTRACT(MINUTE FROM end_time)::INT % 15 = 0
  ),

  -- Blocked slots must not have a team
  CONSTRAINT chk_blocked_no_team CHECK (
    status != 'blocked' OR team_id IS NULL
  ),

  -- Active bookings must have a team
  CONSTRAINT chk_active_has_team CHECK (
    status != 'active' OR team_id IS NOT NULL
  ),

  -- No negative costs
  CONSTRAINT chk_booking_cost_non_negative CHECK (total_cost_cents >= 0)
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Admins see and manage everything
CREATE POLICY "admin_all_bookings" ON public.bookings
  FOR ALL TO authenticated USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Team users see only their team's bookings plus all blocked slots (so the
-- calendar correctly shows unavailability)
CREATE POLICY "team_read_own_bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    team_id = public.auth_team_id()
    OR status = 'blocked'
  );

-- Team users may create bookings for their own team
CREATE POLICY "team_insert_own_bookings" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id = public.auth_team_id()
    AND status = 'active'
    AND created_by = auth.uid()
  );

-- Team users may cancel their own active bookings
CREATE POLICY "team_cancel_own_bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (team_id = public.auth_team_id() AND status = 'active')
  WITH CHECK (
    team_id = public.auth_team_id()
    AND status = 'cancelled'    -- can only move to cancelled, not reassign
  );

CREATE INDEX idx_bookings_booking_date ON public.bookings (booking_date);
CREATE INDEX idx_bookings_lane_id      ON public.bookings (lane_id);
CREATE INDEX idx_bookings_space_id     ON public.bookings (space_id);
CREATE INDEX idx_bookings_team_id      ON public.bookings (team_id);
CREATE INDEX idx_bookings_status       ON public.bookings (status);
-- Compound index for the calendar's primary query pattern
CREATE INDEX idx_bookings_lane_date    ON public.bookings (lane_id, booking_date);


-- ---------------------------------------------------------------------------
-- GROOMING SCHEDULES
-- A separate, non-bookable entity. Grooming windows inform the calendar that
-- a lane/space will be unavailable, but are managed independently of bookings.
-- ---------------------------------------------------------------------------
CREATE TABLE public.grooming_schedules (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id       UUID    NOT NULL REFERENCES public.spaces (id) ON DELETE CASCADE,
  lane_id        UUID    REFERENCES public.lanes (id) ON DELETE CASCADE,
                         -- NULL = entire space is being groomed
  scheduled_date DATE    NOT NULL,
  start_time     TIME    NOT NULL,
  end_time       TIME    NOT NULL,
  groomer        TEXT,   -- name / crew identifier
  notes          TEXT,
  created_by     UUID    NOT NULL REFERENCES auth.users (id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_grooming_time_order CHECK (end_time > start_time)
);

ALTER TABLE public.grooming_schedules ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see grooming schedules (calendar needs to grey
-- out these windows for team users too)
CREATE POLICY "authenticated_read_grooming" ON public.grooming_schedules
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "admin_write_grooming" ON public.grooming_schedules
  FOR ALL TO authenticated USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE INDEX idx_grooming_space_date ON public.grooming_schedules (space_id, scheduled_date);
CREATE INDEX idx_grooming_lane_date  ON public.grooming_schedules (lane_id, scheduled_date);


-- ---------------------------------------------------------------------------
-- updated_at triggers  (keep updated_at current on every table that has it)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_spaces_updated_at
  BEFORE UPDATE ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_lanes_updated_at
  BEFORE UPDATE ON public.lanes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_lane_availability_updated_at
  BEFORE UPDATE ON public.lane_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_grooming_schedules_updated_at
  BEFORE UPDATE ON public.grooming_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
