import { type NextRequest } from "next/server";
import {
  ok,
  err,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
} from "@/lib/api/response";
import { getAuthContext, getAdminContext } from "@/lib/api/auth";
import { isDateStr } from "@/app/api/_lib/validate";
import type { PricingRateDetail, TeamStatus } from "@/lib/api/types";

const VALID_TEAM_STATUSES: TeamStatus[] = [
  "residential",
  "local",
  "out_of_state",
  "international",
];

// ---------------------------------------------------------------------------
// GET /api/lanes/[id]/rates
//
// Full rate history for a lane, across all team-status tiers.
// Authenticated (any role).  Supports optional filter: ?team_status=
// Ordered by team_status then effective_from descending (most recent first).
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    const { id: laneId } = await params;
    const teamStatus = req.nextUrl.searchParams.get("team_status");

    if (teamStatus && !VALID_TEAM_STATUSES.includes(teamStatus as TeamStatus)) {
      return badRequest(
        `team_status must be one of: ${VALID_TEAM_STATUSES.join(", ")}`
      );
    }

    // Confirm the lane exists and is visible to this user
    const { data: lane, error: laneErr } = await ctx.supabase
      .from("lanes")
      .select("id, name, space_id")
      .eq("id", laneId)
      .single();

    if (laneErr || !lane) return notFound("Lane");

    let query = ctx.supabase
      .from("pricing_rates")
      .select(
        "id, lane_id, team_status, rate_cents_per_slot, rate_cents_per_15min, " +
          "effective_from, effective_to, created_by, created_at",
        { count: "exact" }
      )
      .eq("lane_id", laneId)
      .order("team_status",    { ascending: true })
      .order("effective_from", { ascending: false });

    if (teamStatus) {
      query = query.eq("team_status", teamStatus);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[lanes/[id]/rates] GET error", error.message);
      return err("Failed to fetch rates");
    }

    return ok(data as unknown as PricingRateDetail[], { total: count ?? 0 });
  } catch (e) {
    console.error("[lanes/[id]/rates] GET unexpected error", e);
    return err("Internal server error");
  }
}

// ---------------------------------------------------------------------------
// POST /api/lanes/[id]/rates
//
// Admin only.  Adds a new pricing rate for a lane + team-status tier.
// Atomically closes the currently active rate and inserts the new one via
// the rotate_pricing_rate() RPC — rates are never mutated in place.
//
// Body:
//   {
//     team_status:           "residential" | "local" | "out_of_state" | "international",
//     rate_cents_per_slot?:  number,   // block-scheduled lanes
//     rate_cents_per_15min?: number,   // rink lanes
//     effective_from:        "YYYY-MM-DD"
//   }
//
// Returns 201 with the new PricingRateDetail.
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAdminContext();
    if (!ctx) return unauthorized();

    const { id: laneId } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    const {
      team_status,
      rate_cents_per_slot  = null,
      rate_cents_per_15min = null,
      effective_from,
    } = body as Record<string, unknown>;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!team_status || !VALID_TEAM_STATUSES.includes(team_status as TeamStatus)) {
      return badRequest(
        `team_status is required and must be one of: ${VALID_TEAM_STATUSES.join(", ")}`
      );
    }

    if (!isDateStr(effective_from)) {
      return badRequest("effective_from must be a valid YYYY-MM-DD date");
    }

    const hasSlotRate  = rate_cents_per_slot  != null;
    const has15minRate = rate_cents_per_15min != null;

    if (hasSlotRate && has15minRate) {
      return badRequest(
        "Provide rate_cents_per_slot OR rate_cents_per_15min — not both"
      );
    }
    if (!hasSlotRate && !has15minRate) {
      return badRequest(
        "Provide rate_cents_per_slot (block-scheduled lanes) or rate_cents_per_15min (rink lanes)"
      );
    }

    if (hasSlotRate) {
      if (!Number.isInteger(rate_cents_per_slot) || (rate_cents_per_slot as number) <= 0) {
        return badRequest("rate_cents_per_slot must be a positive integer (cents)");
      }
    }
    if (has15minRate) {
      if (!Number.isInteger(rate_cents_per_15min) || (rate_cents_per_15min as number) <= 0) {
        return badRequest("rate_cents_per_15min must be a positive integer (cents)");
      }
    }

    // ── Confirm lane exists ───────────────────────────────────────────────
    const { data: lane, error: laneErr } = await ctx.supabase
      .from("lanes")
      .select("id, space_id")
      .eq("id", laneId)
      .single();

    if (laneErr || !lane) return notFound("Lane");

    // ── Verify rate type matches space type ───────────────────────────────
    const { data: space, error: spaceErr } = await ctx.supabase
      .from("spaces")
      .select("space_type")
      .eq("id", lane.space_id)
      .single();

    if (spaceErr || !space) return notFound("Space");

    if (space.space_type === "block_scheduled" && has15minRate) {
      return badRequest(
        "This is a block-scheduled space — use rate_cents_per_slot, not rate_cents_per_15min"
      );
    }
    if (space.space_type === "rink" && hasSlotRate) {
      return badRequest(
        "This is a rink space — use rate_cents_per_15min, not rate_cents_per_slot"
      );
    }

    // ── Atomic rate rotation via RPC ──────────────────────────────────────
    const { data: rpcData, error: rpcErr } = await ctx.supabase.rpc(
      "rotate_pricing_rate",
      {
        p_lane_id:              laneId,
        p_team_status:          team_status,
        p_rate_cents_per_slot:  rate_cents_per_slot  ?? null,
        p_rate_cents_per_15min: rate_cents_per_15min ?? null,
        p_effective_from:       effective_from,
        p_created_by:           ctx.user.id,
      }
    );

    if (rpcErr) {
      if (rpcErr.code === "P0003") {
        return badRequest(
          "effective_from must be after the currently active rate's effective_from"
        );
      }
      // 23514 = check constraint violation (e.g., chk_rate_date_order)
      if (rpcErr.code === "23514") {
        return badRequest("Rate date constraint violation — check effective_from value");
      }
      console.error("[lanes/[id]/rates] POST rpc error", rpcErr.message);
      return err("Failed to create pricing rate");
    }

    const newRate = (rpcData as unknown as PricingRateDetail[])?.[0];
    if (!newRate) return err("Rate created but data not returned");

    return ok(newRate, undefined, 201);
  } catch (e) {
    console.error("[lanes/[id]/rates] POST unexpected error", e);
    return err("Internal server error");
  }
}
