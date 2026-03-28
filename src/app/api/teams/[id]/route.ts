import { type NextRequest } from "next/server";
import { ok, err, unauthorized, notFound, badRequest } from "@/lib/api/response";
import { getAdminContext } from "@/lib/api/auth";
import type { TeamStatus, TeamDetail } from "@/lib/api/types";

const VALID_STATUSES: TeamStatus[] = [
  "residential",
  "local",
  "out_of_state",
  "international",
];

// ---------------------------------------------------------------------------
// PUT /api/teams/[id]
//
// Admin only.  Updates an existing team.
// All fields are optional — only provided fields are updated.
//
// Body (all optional):
//   {
//     name?:   string,
//     status?: "residential" | "local" | "out_of_state" | "international",
//     active?: boolean,
//     notes?:  string | null
//   }
//
// Returns the updated TeamDetail.
// ---------------------------------------------------------------------------
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAdminContext();
    if (!ctx) return unauthorized();

    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    const b = body as Record<string, unknown>;

    // ── Build update payload ──────────────────────────────────────────────
    const payload: Record<string, unknown> = {};

    if ("name" in b) {
      if (typeof b.name !== "string" || b.name.trim().length === 0) {
        return badRequest("name must be a non-empty string");
      }
      payload.name = b.name.trim();
    }

    if ("status" in b) {
      if (!VALID_STATUSES.includes(b.status as TeamStatus)) {
        return badRequest(
          `status must be one of: ${VALID_STATUSES.join(", ")}`
        );
      }
      payload.status = b.status;
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
      .from("teams")
      .update(payload)
      .eq("id", id)
      .select("id, name, status, active, notes, created_at")
      .single();

    if (error) {
      if (error.code === "PGRST116") return notFound("Team");
      console.error("[teams/[id]] PUT error", error.message);
      return err("Failed to update team");
    }

    return ok(data as TeamDetail);
  } catch (e) {
    console.error("[teams/[id]] PUT unexpected error", e);
    return err("Internal server error");
  }
}
