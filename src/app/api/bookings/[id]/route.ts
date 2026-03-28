import { type NextRequest } from "next/server";
import { ok, err, unauthorized, forbidden, notFound } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";

/**
 * GET /api/bookings/[id]
 *
 * Admins can fetch any booking.
 * Team users can fetch bookings belonging to their team, plus any blocked slot.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    const { id } = await params;

    const { data, error } = await ctx.supabase
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
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return notFound("Booking");
      console.error("[bookings/[id]] query error", error.message);
      return err("Failed to fetch booking");
    }

    // Team users: only their own bookings or blocked slots (RLS also enforces this,
    // but we add an explicit 403 so the caller gets a clear error instead of 404)
    if (ctx.profile.role === "team") {
      const isOwn    = data.team_id === ctx.profile.team_id;
      const isBlocked = data.status === "blocked";
      if (!isOwn && !isBlocked) return forbidden();
    }

    return ok(data);
  } catch (e) {
    console.error("[bookings/[id]] unexpected error", e);
    return err("Internal server error");
  }
}
