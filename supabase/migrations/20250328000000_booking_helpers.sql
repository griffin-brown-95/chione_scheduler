-- =============================================================================
-- Booking Helpers — Atomic RPC functions and supporting indexes
-- Migration: 20250328000000_booking_helpers.sql
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Partial unique index — DB-level guard against slot double-booking.
-- Works alongside the conflict check inside create_booking() so concurrent
-- requests that race past the SELECT still fail safely on INSERT.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX uidx_bookings_no_slot_dup
  ON public.bookings (lane_id, booking_date, slot_id)
  WHERE status != 'cancelled' AND slot_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- create_booking()
--
-- Atomically checks for conflicts and inserts a booking in a single
-- Postgres transaction.
--
-- SECURITY DEFINER so the conflict-check SELECT can see *all* non-cancelled
-- bookings regardless of team-scoped RLS.  The calling API route is
-- responsible for all authorization decisions (auth, team scoping, etc.)
-- before invoking this function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking(
  p_lane_id          UUID,
  p_space_id         UUID,
  p_booking_date     DATE,
  p_slot_id          UUID,           -- NULL for rink bookings
  p_start_time       TIME,           -- NULL for block-scheduled bookings
  p_end_time         TIME,           -- NULL for block-scheduled bookings
  p_team_id          UUID,           -- NULL for blocked slots
  p_group_id         UUID,           -- optional
  p_status           booking_status,
  p_block_reason     TEXT,           -- populated when status = 'blocked'
  p_total_cost_cents INT,
  p_notes            TEXT,
  p_created_by       UUID
)
RETURNS SETOF public.bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN

  -- ── Slot conflict check (block_scheduled lanes) ──────────────────────────
  IF p_slot_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE  lane_id       = p_lane_id
        AND  booking_date  = p_booking_date
        AND  slot_id       = p_slot_id
        AND  status       != 'cancelled'
    ) THEN
      RAISE EXCEPTION 'slot_conflict'
        USING ERRCODE = 'P0001',
              DETAIL  = 'That slot is already booked on this lane for this date';
    END IF;
  END IF;

  -- ── Time-overlap conflict check (rink lanes — 15-min increments) ─────────
  IF p_start_time IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE  lane_id       = p_lane_id
        AND  booking_date  = p_booking_date
        AND  slot_id      IS NULL
        AND  status       != 'cancelled'
        AND  start_time    < p_end_time
        AND  end_time      > p_start_time
    ) THEN
      RAISE EXCEPTION 'time_conflict'
        USING ERRCODE = 'P0002',
              DETAIL  = 'That time range overlaps with an existing booking on this lane';
    END IF;
  END IF;

  -- ── Insert ────────────────────────────────────────────────────────────────
  RETURN QUERY
  INSERT INTO public.bookings (
    lane_id, space_id, booking_date,
    slot_id, start_time, end_time,
    team_id, group_id, status, block_reason,
    total_cost_cents, notes, created_by
  )
  VALUES (
    p_lane_id, p_space_id, p_booking_date,
    p_slot_id, p_start_time, p_end_time,
    p_team_id, p_group_id, p_status, p_block_reason,
    p_total_cost_cents, p_notes, p_created_by
  )
  RETURNING *;

END;
$$;

-- Callable by authenticated users only; anon callers are blocked.
REVOKE ALL ON FUNCTION public.create_booking(
  UUID, UUID, DATE, UUID, TIME, TIME,
  UUID, UUID, public.booking_status, TEXT, INT, TEXT, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_booking(
  UUID, UUID, DATE, UUID, TIME, TIME,
  UUID, UUID, public.booking_status, TEXT, INT, TEXT, UUID
) TO authenticated;


-- ---------------------------------------------------------------------------
-- rotate_pricing_rate()
--
-- Atomically closes the currently active pricing rate for a lane+tier (sets
-- effective_to to the day before the new rate's effective_from) and inserts
-- the new open-ended rate — all in one transaction.
--
-- SECURITY DEFINER to bypass the admin-only RLS on pricing_rates.
-- The calling API route must verify the caller is an admin before invoking.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rotate_pricing_rate(
  p_lane_id               UUID,
  p_team_status           team_status,
  p_rate_cents_per_slot   INT,    -- NULL for rink lanes
  p_rate_cents_per_15min  INT,    -- NULL for block-scheduled lanes
  p_effective_from        DATE,
  p_created_by            UUID
)
RETURNS SETOF public.pricing_rates
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_existing_from DATE;
BEGIN

  -- Guard: new effective_from must be strictly after any existing active rate's
  -- effective_from, otherwise the closing date would violate chk_rate_date_order.
  SELECT effective_from
    INTO v_existing_from
    FROM public.pricing_rates
   WHERE lane_id     = p_lane_id
     AND team_status = p_team_status
     AND effective_to IS NULL;

  IF v_existing_from IS NOT NULL AND p_effective_from <= v_existing_from THEN
    RAISE EXCEPTION 'rate_date_conflict'
      USING ERRCODE = 'P0003',
            DETAIL  = 'new effective_from must be after the existing active rate''s effective_from';
  END IF;

  -- Close the currently active rate (the day before becomes its last day).
  UPDATE public.pricing_rates
     SET effective_to = p_effective_from - INTERVAL '1 day'
   WHERE lane_id      = p_lane_id
     AND team_status  = p_team_status
     AND effective_to IS NULL;

  -- Insert the new open-ended rate.
  RETURN QUERY
  INSERT INTO public.pricing_rates (
    lane_id, team_status,
    rate_cents_per_slot, rate_cents_per_15min,
    effective_from, effective_to, created_by
  )
  VALUES (
    p_lane_id, p_team_status,
    p_rate_cents_per_slot, p_rate_cents_per_15min,
    p_effective_from, NULL, p_created_by
  )
  RETURNING *;

END;
$$;

REVOKE ALL ON FUNCTION public.rotate_pricing_rate(
  UUID, public.team_status, INT, INT, DATE, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rotate_pricing_rate(
  UUID, public.team_status, INT, INT, DATE, UUID
) TO authenticated;
