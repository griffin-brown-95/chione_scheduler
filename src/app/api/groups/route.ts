import { type NextRequest } from "next/server";
import { ok, err, unauthorized, forbidden, badRequest, notFound } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { isUuid } from "@/app/api/_lib/validate";
import type { GroupDetail } from "@/lib/api/types";

const GROUP_SELECT =
  "id, team_id, name, active, notes, created_at, updated_at";

// ---------------------------------------------------------------------------
// POST /api/groups
//
// Creates a group (sub-unit within a team, e.g. "U16 Girls", "Elite A").
//
// Admin: may create a group for any team_id.
// Team users: may create groups only for their own team; team_id is inferred
//   from their profile and any provided team_id must match.
//
// Body:
//   {
//     team_id: string,    // required for admins; optional for team users
//     name:    string,
//     active?: boolean,   // default true
//     notes?:  string
//   }
//
// Returns 201 with the new GroupDetail.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    const {
      team_id,
      name,
      active = true,
      notes  = null,
    } = body as Record<string, unknown>;

    // ── Resolve team_id ───────────────────────────────────────────────────
    // Admin: team_id is required in the body.
    // Team users: team_id must match their own team (or be omitted).
    let resolvedTeamId: string;

    if (ctx.profile.role === "admin") {
      if (!isUuid(team_id)) {
        return badRequest("team_id is required and must be a valid UUID");
      }
      resolvedTeamId = team_id;
    } else {
      if (!ctx.profile.team_id) {
        return err("Your profile has no team assigned", 403);
      }
      if (team_id != null && team_id !== ctx.profile.team_id) {
        return forbidden();
      }
      resolvedTeamId = ctx.profile.team_id;
    }

    // ── Validate other fields ─────────────────────────────────────────────
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return badRequest("name is required and must be a non-empty string");
    }
    if (typeof active !== "boolean") {
      return badRequest("active must be a boolean");
    }
    if (notes !== null && typeof notes !== "string") {
      return badRequest("notes must be a string");
    }

    // ── Confirm team exists ───────────────────────────────────────────────
    const { data: team, error: teamErr } = await ctx.supabase
      .from("teams")
      .select("id, active")
      .eq("id", resolvedTeamId)
      .single();

    if (teamErr || !team) return notFound("Team");
    if (!team.active)     return badRequest("Team account is not active");

    // ── Insert ────────────────────────────────────────────────────────────
    const { data, error } = await ctx.supabase
      .from("groups")
      .insert({
        team_id: resolvedTeamId,
        name:    name.trim(),
        active,
        notes:   notes ?? null,
      })
      .select(GROUP_SELECT)
      .single();

    if (error) {
      console.error("[groups] POST insert error", error.message);
      return err("Failed to create group");
    }

    return ok(data as GroupDetail, undefined, 201);
  } catch (e) {
    console.error("[groups] POST unexpected error", e);
    return err("Internal server error");
  }
}
