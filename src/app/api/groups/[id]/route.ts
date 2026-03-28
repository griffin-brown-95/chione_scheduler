import { type NextRequest } from "next/server";
import { ok, err, unauthorized, forbidden, notFound, badRequest } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import type { GroupDetail } from "@/lib/api/types";

const GROUP_SELECT =
  "id, team_id, name, active, notes, created_at, updated_at";

// ---------------------------------------------------------------------------
// PUT /api/groups/[id]
//
// Updates a group.  All body fields are optional.
//
// Admin: may update any group.
// Team users: may update only groups that belong to their own team.
//
// Body (all optional):
//   {
//     name?:   string,
//     active?: boolean,
//     notes?:  string | null
//   }
//
// Returns the updated GroupDetail.
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

    // ── Verify the group exists and check ownership ───────────────────────
    const { data: existing, error: fetchErr } = await ctx.supabase
      .from("groups")
      .select("id, team_id")
      .eq("id", id)
      .single();

    if (fetchErr) {
      if (fetchErr.code === "PGRST116") return notFound("Group");
      console.error("[groups/[id]] PUT fetch error", fetchErr.message);
      return err("Failed to fetch group");
    }

    // Team users may only edit their own team's groups
    if (ctx.profile.role === "team") {
      if (existing.team_id !== ctx.profile.team_id) return forbidden();
    }

    // ── Build update payload ──────────────────────────────────────────────
    const b = body as Record<string, unknown>;
    const payload: Record<string, unknown> = {};

    if ("name" in b) {
      if (typeof b.name !== "string" || b.name.trim().length === 0) {
        return badRequest("name must be a non-empty string");
      }
      payload.name = b.name.trim();
    }

    if ("active" in b) {
      if (typeof b.active !== "boolean") {
        return badRequest("active must be a boolean");
      }
      payload.active = b.active;
    }

    if ("notes" in b) {
      if (b.notes !== null && typeof b.notes !== "string") {
        return badRequest("notes must be a string or null");
      }
      payload.notes = b.notes ?? null;
    }

    if (Object.keys(payload).length === 0) {
      return badRequest("No updatable fields provided");
    }

    // ── Update ────────────────────────────────────────────────────────────
    const { data, error } = await ctx.supabase
      .from("groups")
      .update(payload)
      .eq("id", id)
      .select(GROUP_SELECT)
      .single();

    if (error) {
      if (error.code === "PGRST116") return notFound("Group");
      console.error("[groups/[id]] PUT update error", error.message);
      return err("Failed to update group");
    }

    return ok(data as GroupDetail);
  } catch (e) {
    console.error("[groups/[id]] PUT unexpected error", e);
    return err("Internal server error");
  }
}
