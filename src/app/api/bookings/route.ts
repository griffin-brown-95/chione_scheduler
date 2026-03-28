import { type NextRequest } from "next/server";
import {
  ok,
  err,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
} from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { isValidDateParam } from "@/app/api/_lib/schedule";
import {
  isUuid,
  isDateStr,
  isTimeStr,
  is15MinAligned,
  timeLt,
  minutesBetween,
} from "@/app/api/_lib/validate";
import type { BookingStatus } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Shared select fragment — keeps GET list and POST response identical
// ---------------------------------------------------------------------------
const BOOKING_SELECT = `
  id,
  lane_id,
  space_id,
  booking_date,
  slot_id,
  start_time,
  end_time,
  team_id,
  group_id,
  status,
  block_reason,
  total_cost_cents,
  notes,
  created_at,
  updated_at,
  lane:lanes(id, name),
  space:spaces(id, name, space_type),
  team:teams(id, name, status),
  group:groups(id, name),
  time_slot:time_slots(id, label, start_time, end_time, sort_order)
`;

// ---------------------------------------------------------------------------
// GET /api/bookings
//
// Admin only. Supports filtering via query params:
//   ?team_id=   — filter by team UUID
//   ?space_id=  — filter by space UUID
//   ?from=      — start of date range (YYYY-MM-DD, inclusive)
//   ?to=        — end of date range   (YYYY-MM-DD, inclusive)
//   ?status=    — active | blocked | cancelled
//   ?limit=     — max rows (default 200, max 1000)
//   ?offset=    — pagination offset (default 0)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();
    if (ctx.profile.role !== "admin") return forbidden();

    const p = req.nextUrl.searchParams;
    const teamId  = p.get("team_id");
    const spaceId = p.get("space_id");
    const from    = p.get("from");
    const to      = p.get("to");
    const status  = p.get("status");
    const limit   = Math.min(parseInt(p.get("limit") ?? "200", 10), 1000);
    const offset  = parseInt(p.get("offset") ?? "0", 10);

    if (from && !isValidDateParam(from)) return badRequest("Invalid 'from' date");
    if (to   && !isValidDateParam(to))   return badRequest("Invalid 'to' date");

    const validStatuses = ["active", "blocked", "cancelled"];
    if (status && !validStatuses.includes(status)) {
      return badRequest(`Invalid status — must be one of: ${validStatuses.join(", ")}`);
    }

    let query = ctx.supabase
      .from("bookings")
      .select(BOOKING_SELECT, { count: "exact" })
      .order("booking_date", { ascending: false })
      .order("created_at",   { ascending: false })
      .range(offset, offset + limit - 1);

    if (teamId)  query = query.eq("team_id",      teamId);
    if (spaceId) query = query.eq("space_id",     spaceId);
    if (from)    query = query.gte("booking_date", from);
    if (to)      query = query.lte("booking_date", to);
    if (status)  query = query.eq("status",       status);

    const { data, error, count } = await query;

    if (error) {
      console.error("[bookings] GET error", error.message);
      return err("Failed to fetch bookings");
    }

    return ok(data, { total: count ?? 0, limit, offset });
  } catch (e) {
    console.error("[bookings] GET unexpected error", e);
    return err("Internal server error");
  }
}

// ---------------------------------------------------------------------------
// POST /api/bookings
//
// Creates a booking.  Atomically checks for slot / time conflicts via the
// create_booking() Postgres RPC, then snapshots the rate so future rate
// changes never retroactively alter historical costs.
//
// Body — block-scheduled lane:
//   { lane_id, booking_date, slot_id, team_id, group_id?, notes? }
//
// Body — rink lane (15-min billing):
//   { lane_id, booking_date, start_time, end_time, team_id, group_id?, notes? }
//
// Body — admin block (no team):
//   { lane_id, booking_date, slot_id | start_time+end_time,
//     status: "blocked", block_reason? }
//
// Returns 201 with the full BookingDetail on success.
// Returns 409 when a conflict is detected.
// Returns 422 when no pricing rate exists for the lane / team tier / date.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    const {
      lane_id,
      booking_date,
      slot_id    = null,
      start_time = null,
      end_time   = null,
      team_id    = null,
      group_id   = null,
      status     = "active",
      block_reason = null,
      notes      = null,
    } = body as Record<string, unknown>;

    // ── Field validation ────────────────────────────────────────────────────
    if (!isUuid(lane_id))       return badRequest("lane_id must be a valid UUID");
    if (!isDateStr(booking_date)) return badRequest("booking_date must be a valid YYYY-MM-DD date");

    const hasSlot  = slot_id    != null;
    const hasTimes = start_time != null || end_time != null;

    if (hasSlot && hasTimes) {
      return badRequest("Provide slot_id OR start_time/end_time — not both");
    }
    if (!hasSlot && !hasTimes) {
      return badRequest(
        "Provide either slot_id (block-scheduled lanes) or start_time + end_time (rink lanes)"
      );
    }
    if (hasSlot && !isUuid(slot_id)) {
      return badRequest("slot_id must be a valid UUID");
    }
    if (hasTimes) {
      if (!isTimeStr(start_time))  return badRequest("start_time must be a valid 24-hour time (HH:MM)");
      if (!isTimeStr(end_time))    return badRequest("end_time must be a valid 24-hour time (HH:MM)");
      if (!timeLt(start_time as string, end_time as string)) {
        return badRequest("end_time must be after start_time");
      }
      if (!is15MinAligned(start_time as string)) {
        return badRequest("start_time must be on a 15-minute boundary (HH:00, HH:15, HH:30, HH:45)");
      }
      if (!is15MinAligned(end_time as string)) {
        return badRequest("end_time must be on a 15-minute boundary (HH:00, HH:15, HH:30, HH:45)");
      }
    }

    const validStatuses: BookingStatus[] = ["active", "blocked"];
    if (!validStatuses.includes(status as BookingStatus)) {
      return badRequest('status must be "active" or "blocked"');
    }

    // Blocked slots are admin-only
    if (status === "blocked" && ctx.profile.role !== "admin") return forbidden();

    // Active bookings require a team
    if (status === "active") {
      if (!isUuid(team_id)) return badRequest("team_id is required for active bookings");
      // Team users may only book for their own team
      if (ctx.profile.role === "team" && team_id !== ctx.profile.team_id) {
        return forbidden();
      }
    }

    if (group_id !== null && !isUuid(group_id)) {
      return badRequest("group_id must be a valid UUID");
    }

    // ── Resolve lane ────────────────────────────────────────────────────────
    const { data: lane, error: laneErr } = await ctx.supabase
      .from("lanes")
      .select("id, space_id, active")
      .eq("id", lane_id)
      .single();

    if (laneErr || !lane) return notFound("Lane");
    if (!lane.active)     return badRequest("Lane is not active");

    // ── Resolve space ───────────────────────────────────────────────────────
    const { data: space, error: spaceErr } = await ctx.supabase
      .from("spaces")
      .select("id, space_type, active")
      .eq("id", lane.space_id)
      .single();

    if (spaceErr || !space) return notFound("Space");
    if (!space.active)      return badRequest("Space is not active");

    // Validate time mode matches space type
    if (space.space_type === "block_scheduled" && hasTimes) {
      return badRequest(
        "This is a block-scheduled space — use slot_id, not start_time/end_time"
      );
    }
    if (space.space_type === "rink" && hasSlot) {
      return badRequest(
        "This is a rink space — use start_time/end_time, not slot_id"
      );
    }

    // ── Validate slot belongs to the space ──────────────────────────────────
    if (hasSlot) {
      const { data: slot, error: slotErr } = await ctx.supabase
        .from("time_slots")
        .select("id, active")
        .eq("id", slot_id)
        .eq("space_id", lane.space_id)
        .single();

      if (slotErr || !slot) {
        return badRequest("slot_id does not belong to the space this lane is in");
      }
      if (!slot.active) return badRequest("That time slot is not active");
    }

    // ── Validate group belongs to the team ──────────────────────────────────
    if (group_id !== null && team_id !== null) {
      const { data: grp, error: grpErr } = await ctx.supabase
        .from("groups")
        .select("id, team_id")
        .eq("id", group_id)
        .single();

      if (grpErr || !grp) return badRequest("Group not found");
      if (grp.team_id !== team_id) {
        return badRequest("group_id does not belong to the specified team");
      }
    }

    // ── Rate snapshot ────────────────────────────────────────────────────────
    // Look up the rate effective on booking_date and store the cost so future
    // rate changes never alter historical invoice amounts.
    let total_cost_cents = 0;

    if (status === "active") {
      // Get the team's pricing tier
      const { data: team, error: teamErr } = await ctx.supabase
        .from("teams")
        .select("id, status, active")
        .eq("id", team_id)
        .single();

      if (teamErr || !team) return notFound("Team");
      if (!team.active)     return badRequest("Team account is not active");

      // Find the rate effective on booking_date for this lane + team tier
      const { data: rate } = await ctx.supabase
        .from("pricing_rates")
        .select("rate_cents_per_slot, rate_cents_per_15min")
        .eq("lane_id", lane_id)
        .eq("team_status", team.status)
        .lte("effective_from", booking_date)
        .or(`effective_to.is.null,effective_to.gte.${booking_date}`)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!rate) {
        return err(
          `No pricing rate found for ${team.status} teams on this lane as of ${booking_date}. ` +
            "Add a rate via POST /api/lanes/:id/rates before creating bookings.",
          422
        );
      }

      if (space.space_type === "block_scheduled") {
        if (rate.rate_cents_per_slot == null) {
          return err("Lane has no per-slot rate configured", 422);
        }
        total_cost_cents = rate.rate_cents_per_slot;
      } else {
        // rink
        if (rate.rate_cents_per_15min == null) {
          return err("Lane has no per-15-minute rate configured", 422);
        }
        const minutes     = minutesBetween(start_time as string, end_time as string);
        const increments  = minutes / 15;
        total_cost_cents  = rate.rate_cents_per_15min * increments;
      }
    }

    // ── Atomic conflict check + insert via RPC ───────────────────────────────
    const { data: rpcData, error: rpcErr } = await ctx.supabase.rpc(
      "create_booking",
      {
        p_lane_id:          lane_id,
        p_space_id:         lane.space_id,
        p_booking_date:     booking_date,
        p_slot_id:          slot_id  ?? null,
        p_start_time:       start_time ?? null,
        p_end_time:         end_time   ?? null,
        p_team_id:          team_id    ?? null,
        p_group_id:         group_id   ?? null,
        p_status:           status,
        p_block_reason:     block_reason ?? null,
        p_total_cost_cents: total_cost_cents,
        p_notes:            notes ?? null,
        p_created_by:       ctx.user.id,
      }
    );

    if (rpcErr) {
      // P0001 = slot_conflict raised inside create_booking()
      if (rpcErr.code === "P0001") {
        return err("That slot is already booked on this lane for this date", 409);
      }
      // P0002 = time_conflict raised inside create_booking()
      if (rpcErr.code === "P0002") {
        return err("That time range overlaps with an existing booking on this lane", 409);
      }
      // 23505 = unique violation from uidx_bookings_no_slot_dup (concurrent insert race)
      if (rpcErr.code === "23505") {
        return err("That slot is already booked (concurrent request — please retry)", 409);
      }
      console.error("[bookings] POST create_booking rpc error", rpcErr.message);
      return err("Failed to create booking");
    }

    const newId = (rpcData as Array<{ id: string }>)?.[0]?.id;
    if (!newId) {
      console.error("[bookings] POST rpc returned no row");
      return err("Booking created but ID not returned");
    }

    // Fetch full detail to return in the response
    const { data: booking, error: fetchErr } = await ctx.supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("id", newId)
      .single();

    if (fetchErr || !booking) {
      console.error("[bookings] POST fetch after create error", fetchErr?.message);
      return err("Booking created but could not fetch detail");
    }

    return ok(booking, undefined, 201);
  } catch (e) {
    console.error("[bookings] POST unexpected error", e);
    return err("Internal server error");
  }
}
