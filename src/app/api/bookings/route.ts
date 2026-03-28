import { type NextRequest } from "next/server";
import { ok, err, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { isValidDateParam } from "@/app/api/_lib/schedule";

/**
 * GET /api/bookings
 *
 * Admin only. Supports filtering via query params:
 *   ?team_id=   — filter by team UUID
 *   ?space_id=  — filter by space UUID
 *   ?from=      — start of date range (YYYY-MM-DD, inclusive)
 *   ?to=        — end of date range   (YYYY-MM-DD, inclusive)
 *   ?status=    — active | blocked | cancelled
 *   ?limit=     — max rows (default 200, max 1000)
 *   ?offset=    — pagination offset (default 0)
 */
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

    // Validate date params
    if (from && !isValidDateParam(from)) return badRequest("Invalid 'from' date");
    if (to   && !isValidDateParam(to))   return badRequest("Invalid 'to' date");

    // Validate status enum
    const validStatuses = ["active", "blocked", "cancelled"];
    if (status && !validStatuses.includes(status)) {
      return badRequest(`Invalid status — must be one of: ${validStatuses.join(", ")}`);
    }

    let query = ctx.supabase
      .from("bookings")
      .select(
        `
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
      `,
        { count: "exact" }
      )
      .order("booking_date", { ascending: false })
      .order("created_at",   { ascending: false })
      .range(offset, offset + limit - 1);

    if (teamId)  query = query.eq("team_id", teamId);
    if (spaceId) query = query.eq("space_id", spaceId);
    if (from)    query = query.gte("booking_date", from);
    if (to)      query = query.lte("booking_date", to);
    if (status)  query = query.eq("status", status);

    const { data, error, count } = await query;

    if (error) {
      console.error("[bookings] query error", error.message);
      return err("Failed to fetch bookings");
    }

    return ok(data, { total: count ?? 0, limit, offset });
  } catch (e) {
    console.error("[bookings] unexpected error", e);
    return err("Internal server error");
  }
}
