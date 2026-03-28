import { type NextRequest } from "next/server";
import { ok, err, unauthorized, notFound, badRequest } from "@/lib/api/response";
import { getAdminContext } from "@/lib/api/auth";
import type { SpaceType, SeasonType, SpaceDetail } from "@/lib/api/types";

const VALID_SPACE_TYPES: SpaceType[] = ["block_scheduled", "rink"];
const VALID_SEASONS: SeasonType[] = ["winter", "summer", "year_round"];

const SPACE_SELECT = `
  id,
  name,
  space_type,
  season,
  active,
  notes,
  lanes(id, space_id, name, sort_order, active, notes),
  time_slots(id, label, start_time, end_time, sort_order, active)
`;

/**
 * PUT /api/spaces/[id]
 *
 * Admin only. Updates an existing space. All fields optional.
 *
 * Body (all optional):
 *   {
 *     name?:       string,
 *     space_type?: "block_scheduled" | "rink",
 *     season?:     "winter" | "summer" | "year_round",
 *     active?:     boolean,
 *     notes?:      string | null
 *   }
 */
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
    const payload: Record<string, unknown> = {};

    if ("name" in b) {
      if (typeof b.name !== "string" || b.name.trim().length === 0) {
        return badRequest("name must be a non-empty string");
      }
      payload.name = b.name.trim();
    }

    if ("space_type" in b) {
      if (!VALID_SPACE_TYPES.includes(b.space_type as SpaceType)) {
        return badRequest(`space_type must be one of: ${VALID_SPACE_TYPES.join(", ")}`);
      }
      payload.space_type = b.space_type;
    }

    if ("season" in b) {
      if (!VALID_SEASONS.includes(b.season as SeasonType)) {
        return badRequest(`season must be one of: ${VALID_SEASONS.join(", ")}`);
      }
      payload.season = b.season;
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

    const { data, error } = await ctx.supabase
      .from("spaces")
      .update(payload)
      .eq("id", id)
      .select(SPACE_SELECT)
      .single();

    if (error) {
      if (error.code === "PGRST116") return notFound("Space");
      console.error("[spaces/[id]] PUT error", error.message);
      return err("Failed to update space");
    }

    return ok(data as SpaceDetail);
  } catch (e) {
    console.error("[spaces/[id]] PUT unexpected error", e);
    return err("Internal server error");
  }
}
