import { type NextRequest } from "next/server";
import {
  ok,
  err,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
} from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { isUuid } from "@/app/api/_lib/validate";

// ---------------------------------------------------------------------------
// Shared select fragment — identical shape for GET, PUT responses
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
// GET /api/bookings/[id]
//
// Admins can fetch any booking.
// Team users can fetch their own team's bookings and any blocked slot.
// ---------------------------------------------------------------------------
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
      .select(BOOKING_SELECT)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return notFound("Booking");
      console.error("[bookings/[id]] GET error", error.message);
      return err("Failed to fetch booking");
    }

    // Team users: only their own bookings or blocked slots
    if (ctx.profile.role === "team") {
      const isOwn     = data.team_id === ctx.profile.team_id;
      const isBlocked = data.status  === "blocked";
      if (!isOwn && !isBlocked) return forbidden();
    }

    return ok(data);
  } catch (e) {
    console.error("[bookings/[id]] GET unexpected error", e);
    return err("Internal server error");
  }
}

// ---------------------------------------------------------------------------
// PUT /api/bookings/[id]
//
// Updates booking metadata. Does NOT reschedule (no lane/date/slot changes).
//
// Admin: may update group_id, notes, status, block_reason, team_id.
// Team users: may update only group_id and notes on their own active bookings.
//
// Team updates use the service-role client because the existing RLS UPDATE
// policy for team users only permits changing status to 'cancelled' — it
// intentionally blocks other field changes at the DB level.  Authorization
// is enforced here in the application layer instead.
// ---------------------------------------------------------------------------
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    // ── Verify the booking exists and get current state ─────────────────────
    const { data: existing, error: fetchErr } = await ctx.supabase
      .from("bookings")
      .select("id, team_id, status")
      .eq("id", id)
      .single();

    if (fetchErr) {
      if (fetchErr.code === "PGRST116") return notFound("Booking");
      console.error("[bookings/[id]] PUT fetch error", fetchErr.message);
      return err("Failed to fetch booking");
    }

    // ── Authorization ────────────────────────────────────────────────────────
    if (ctx.profile.role === "team") {
      if (existing.team_id !== ctx.profile.team_id) return forbidden();
      if (existing.status !== "active") {
        return badRequest("Only active bookings can be edited");
      }
    }

    // ── Build update payload ─────────────────────────────────────────────────
    const b = body as Record<string, unknown>;
    const payload: Record<string, unknown> = {};

    if (ctx.profile.role === "team") {
      // Restricted set for team users
      if ("notes"    in b) payload.notes    = b.notes    ?? null;
      if ("group_id" in b) {
        if (b.group_id !== null && !isUuid(b.group_id)) {
          return badRequest("group_id must be a valid UUID");
        }
        payload.group_id = b.group_id ?? null;
      }
    } else {
      // Full set for admins
      if ("notes"        in b) payload.notes        = b.notes        ?? null;
      if ("group_id"     in b) {
        if (b.group_id !== null && !isUuid(b.group_id)) {
          return badRequest("group_id must be a valid UUID");
        }
        payload.group_id = b.group_id ?? null;
      }
      if ("status"       in b) {
        const valid = ["active", "blocked", "cancelled"];
        if (!valid.includes(b.status as string)) {
          return badRequest(`status must be one of: ${valid.join(", ")}`);
        }
        payload.status = b.status;
        // chk_blocked_no_team: blocked bookings must have no team.
        // Auto-clear team_id and group_id when transitioning to blocked,
        // unless the caller is explicitly supplying them as null in the body.
        if (b.status === "blocked") {
          payload.team_id  = b.team_id  !== undefined ? (b.team_id  ?? null) : null;
          payload.group_id = b.group_id !== undefined ? (b.group_id ?? null) : null;
        }
      }
      if ("block_reason" in b) payload.block_reason = b.block_reason ?? null;
      if ("team_id"      in b) {
        if (b.team_id !== null && !isUuid(b.team_id)) {
          return badRequest("team_id must be a valid UUID");
        }
        payload.team_id = b.team_id ?? null;
      }
    }

    if (Object.keys(payload).length === 0) {
      return badRequest("No updatable fields provided");
    }

    // ── Execute update ───────────────────────────────────────────────────────
    // Team users: must bypass RLS via service client because the existing team
    // UPDATE policy only allows transitioning status → 'cancelled'.
    // Admin: their session client has full RLS access.
    let updateResult;

    if (ctx.profile.role === "team") {
      const svc = createServiceClient();
      updateResult = await svc
        .from("bookings")
        .update(payload)
        .eq("id", id)
        .eq("team_id", ctx.profile.team_id!)
        .eq("status", "active")                   // extra guard
        .select(BOOKING_SELECT)
        .single();
    } else {
      updateResult = await ctx.supabase
        .from("bookings")
        .update(payload)
        .eq("id", id)
        .select(BOOKING_SELECT)
        .single();
    }

    const { data: updated, error: updateErr } = updateResult;

    if (updateErr) {
      if (updateErr.code === "PGRST116") return notFound("Booking");
      console.error("[bookings/[id]] PUT update error", updateErr.message);
      return err("Failed to update booking");
    }

    return ok(updated);
  } catch (e) {
    console.error("[bookings/[id]] PUT unexpected error", e);
    return err("Internal server error");
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/bookings/[id]
//
// Cancels a booking (soft delete — sets status = 'cancelled').
//
// Admins can cancel any booking.
// Team users can cancel only their own active bookings.
// The existing team RLS policy "team_cancel_own_bookings" permits exactly
// this update, so the session client handles both roles.
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    const { id } = await params;

    // ── Verify booking exists ─────────────────────────────────────────────
    const { data: existing, error: fetchErr } = await ctx.supabase
      .from("bookings")
      .select("id, team_id, status")
      .eq("id", id)
      .single();

    if (fetchErr) {
      if (fetchErr.code === "PGRST116") return notFound("Booking");
      console.error("[bookings/[id]] DELETE fetch error", fetchErr.message);
      return err("Failed to fetch booking");
    }

    // ── Authorization ─────────────────────────────────────────────────────
    if (ctx.profile.role === "team") {
      if (existing.team_id !== ctx.profile.team_id) return forbidden();
      if (existing.status !== "active") {
        return badRequest("Only active bookings can be cancelled");
      }
    }

    if (existing.status === "cancelled") {
      return badRequest("Booking is already cancelled");
    }

    // ── Cancel ────────────────────────────────────────────────────────────
    const { data: cancelled, error: cancelErr } = await ctx.supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("id, status, updated_at")
      .single();

    if (cancelErr) {
      console.error("[bookings/[id]] DELETE cancel error", cancelErr.message);
      return err("Failed to cancel booking");
    }

    return ok(cancelled);
  } catch (e) {
    console.error("[bookings/[id]] DELETE unexpected error", e);
    return err("Internal server error");
  }
}
