/**
 * Shared schedule query logic used by:
 *   GET /api/schedule/today
 *   GET /api/schedule/[date]
 *   GET /api/spaces/[id]/schedule
 *
 * Strategy: two indexed queries, merged in application code.
 *   1. All active spaces + lanes (tiny result set, stable)
 *   2. All non-cancelled bookings for the date (uses idx_bookings_booking_date)
 * This avoids a PostgREST inner-join limitation that would exclude lanes
 * with zero bookings on a given day.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ScheduleData,
  ScheduleSpace,
  ScheduleLane,
  ScheduleBooking,
} from "@/lib/api/types";

export async function buildSchedule(
  supabase: SupabaseClient,
  date: string,
  spaceId?: string
): Promise<{ data: ScheduleData | null; dbError: string | null }> {
  // ── Query 1: spaces + lanes structure ────────────────────────────────────
  let spacesQuery = supabase
    .from("spaces")
    .select("id, name, space_type, season, lanes(id, name, sort_order)")
    .eq("active", true)
    .order("name");

  if (spaceId) {
    spacesQuery = spacesQuery.eq("id", spaceId);
  }

  const { data: spacesRaw, error: spacesErr } = await spacesQuery;

  if (spacesErr) {
    return { data: null, dbError: spacesErr.message };
  }

  // ── Query 2: bookings for the date ────────────────────────────────────────
  let bookingsQuery = supabase
    .from("bookings")
    .select(
      `
      id,
      lane_id,
      space_id,
      slot_id,
      start_time,
      end_time,
      status,
      block_reason,
      total_cost_cents,
      notes,
      team:teams(id, name, status),
      group:groups(id, name),
      time_slot:time_slots(id, label, slot_start:start_time, slot_end:end_time)
    `
    )
    .eq("booking_date", date)
    .neq("status", "cancelled");

  if (spaceId) {
    bookingsQuery = bookingsQuery.eq("space_id", spaceId);
  }

  const { data: bookingsRaw, error: bookingsErr } = await bookingsQuery;

  if (bookingsErr) {
    return { data: null, dbError: bookingsErr.message };
  }

  // ── Merge: map bookings onto their lanes ──────────────────────────────────
  // Build a quick lookup: lane_id → ScheduleBooking[]
  const bookingsByLane = new Map<string, ScheduleBooking[]>();

  for (const b of bookingsRaw ?? []) {
    const booking: ScheduleBooking = {
      id: b.id,
      slot_id: b.slot_id,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      block_reason: b.block_reason,
      total_cost_cents: b.total_cost_cents,
      notes: b.notes,
      // Supabase returns an object (single FK) — guard against array shape
      team: Array.isArray(b.team) ? (b.team[0] ?? null) : (b.team ?? null),
      group: Array.isArray(b.group) ? (b.group[0] ?? null) : (b.group ?? null),
      time_slot: Array.isArray(b.time_slot)
        ? (b.time_slot[0] ?? null)
        : (b.time_slot ?? null),
    };

    if (!bookingsByLane.has(b.lane_id)) {
      bookingsByLane.set(b.lane_id, []);
    }
    bookingsByLane.get(b.lane_id)!.push(booking);
  }

  // Shape the final response
  const spaces: ScheduleSpace[] = (spacesRaw ?? []).map((s) => {
    const lanes: ScheduleLane[] = ((s.lanes as typeof s.lanes & { id: string; name: string; sort_order: number }[]) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({
        id: l.id,
        name: l.name,
        sort_order: l.sort_order,
        bookings: bookingsByLane.get(l.id) ?? [],
      }));

    return {
      id: s.id,
      name: s.name,
      space_type: s.space_type,
      season: s.season,
      lanes,
    };
  });

  return { data: { date, spaces }, dbError: null };
}

/** Returns today's date in YYYY-MM-DD (server local time) */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Validates that a string is a YYYY-MM-DD date and is a real calendar date */
export function isValidDateParam(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}
