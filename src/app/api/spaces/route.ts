import { type NextRequest } from "next/server";
import { ok, err, unauthorized, badRequest } from "@/lib/api/response";
import { getAuthContext, getAdminContext } from "@/lib/api/auth";
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
  lanes(
    id,
    space_id,
    name,
    sort_order,
    active,
    notes
  ),
  time_slots(
    id,
    label,
    start_time,
    end_time,
    sort_order,
    active
  )
`;

/**
 * GET /api/spaces
 *
 * Authenticated (any role). Returns all active spaces with their nested
 * lanes and time slots — the canonical reference dataset for the booking UI.
 *
 * ?all=true — include inactive spaces (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    const includeAll =
      req.nextUrl.searchParams.get("all") === "true" &&
      ctx.profile.role === "admin";

    let query = ctx.supabase
      .from("spaces")
      .select(SPACE_SELECT, { count: "exact" })
      .order("name")
      .order("sort_order", { referencedTable: "lanes" })
      .order("sort_order", { referencedTable: "time_slots" });

    if (!includeAll) {
      query = query.eq("active", true);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[spaces] query error", error.message);
      return err("Failed to fetch spaces");
    }

    return ok(data, { total: count ?? 0 });
  } catch (e) {
    console.error("[spaces] unexpected error", e);
    return err("Internal server error");
  }
}

/**
 * POST /api/spaces
 *
 * Admin only. Creates a new space.
 *
 * Body:
 *   {
 *     name:        string,
 *     space_type:  "block_scheduled" | "rink",
 *     season:      "winter" | "summer" | "year_round",
 *     active?:     boolean,  // default true
 *     notes?:      string
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAdminContext();
    if (!ctx) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    const {
      name,
      space_type,
      season,
      active = true,
      notes = null,
    } = body as Record<string, unknown>;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return badRequest("name is required and must be a non-empty string");
    }
    if (!VALID_SPACE_TYPES.includes(space_type as SpaceType)) {
      return badRequest(`space_type must be one of: ${VALID_SPACE_TYPES.join(", ")}`);
    }
    if (!VALID_SEASONS.includes(season as SeasonType)) {
      return badRequest(`season must be one of: ${VALID_SEASONS.join(", ")}`);
    }
    if (typeof active !== "boolean") {
      return badRequest("active must be a boolean");
    }
    if (notes !== null && typeof notes !== "string") {
      return badRequest("notes must be a string");
    }

    const { data, error } = await ctx.supabase
      .from("spaces")
      .insert({ name: name.trim(), space_type, season, active, notes: notes ?? null })
      .select(SPACE_SELECT)
      .single();

    if (error) {
      console.error("[spaces] POST insert error", error.message);
      return err("Failed to create space");
    }

    return ok(data as SpaceDetail, undefined, 201);
  } catch (e) {
    console.error("[spaces] POST unexpected error", e);
    return err("Internal server error");
  }
}
