import { type NextRequest } from "next/server";
import { ok, err, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { getAuthContext, getAdminContext } from "@/lib/api/auth";
import type { TeamStatus, TeamDetail } from "@/lib/api/types";

const VALID_STATUSES: TeamStatus[] = [
  "residential",
  "local",
  "out_of_state",
  "international",
];

// ---------------------------------------------------------------------------
// GET /api/teams
//
// Admin only — returns all teams.
// Team users don't need a list of all teams; they interact only with their own.
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();
    if (ctx.profile.role !== "admin") return forbidden();

    const { data, error, count } = await ctx.supabase
      .from("teams")
      .select("id, name, status, active, notes, created_at", { count: "exact" })
      .order("name");

    if (error) {
      console.error("[teams] GET error", error.message);
      return err("Failed to fetch teams");
    }

    return ok(data, { total: count ?? 0 });
  } catch (e) {
    console.error("[teams] GET unexpected error", e);
    return err("Internal server error");
  }
}

// ---------------------------------------------------------------------------
// POST /api/teams
//
// Admin only.  Creates a new team.
//
// Body:
//   {
//     name:    string,
//     status:  "residential" | "local" | "out_of_state" | "international",
//     active?: boolean,   // default true
//     notes?:  string
//   }
//
// Returns 201 with the new TeamDetail.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAdminContext();
    if (!ctx) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    const {
      name,
      status,
      active = true,
      notes  = null,
    } = body as Record<string, unknown>;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return badRequest("name is required and must be a non-empty string");
    }
    if (!VALID_STATUSES.includes(status as TeamStatus)) {
      return badRequest(
        `status is required and must be one of: ${VALID_STATUSES.join(", ")}`
      );
    }
    if (typeof active !== "boolean") {
      return badRequest("active must be a boolean");
    }
    if (notes !== null && typeof notes !== "string") {
      return badRequest("notes must be a string");
    }

    // ── Insert ────────────────────────────────────────────────────────────
    const { data, error } = await ctx.supabase
      .from("teams")
      .insert({
        name:   name.trim(),
        status,
        active,
        notes:  notes ?? null,
      })
      .select("id, name, status, active, notes, created_at")
      .single();

    if (error) {
      console.error("[teams] POST insert error", error.message);
      return err("Failed to create team");
    }

    return ok(data as TeamDetail, undefined, 201);
  } catch (e) {
    console.error("[teams] POST unexpected error", e);
    return err("Internal server error");
  }
}
