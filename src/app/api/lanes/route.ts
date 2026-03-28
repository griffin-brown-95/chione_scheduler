import { type NextRequest } from "next/server";
import { ok, err, unauthorized, badRequest, notFound } from "@/lib/api/response";
import { getAuthContext, getAdminContext } from "@/lib/api/auth";
import { isUuid } from "@/app/api/_lib/validate";
import type { LaneDetail } from "@/lib/api/types";

/**
 * GET /api/lanes
 *
 * Authenticated (any role). Returns lanes, optionally filtered by space.
 *   ?space_id=  — filter to a single space
 *   ?active=    — "true" | "false" (default: only active lanes)
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    const p       = req.nextUrl.searchParams;
    const spaceId = p.get("space_id");
    // Default to active-only; pass ?active=false to include inactive lanes
    const activeOnly = p.get("active") !== "false";

    let query = ctx.supabase
      .from("lanes")
      .select("id, space_id, name, sort_order, active, notes", { count: "exact" })
      .order("space_id")
      .order("sort_order");

    if (spaceId)   query = query.eq("space_id", spaceId);
    if (activeOnly) query = query.eq("active", true);

    const { data, error, count } = await query;

    if (error) {
      console.error("[lanes] query error", error.message);
      return err("Failed to fetch lanes");
    }

    return ok(data, { total: count ?? 0 });
  } catch (e) {
    console.error("[lanes] unexpected error", e);
    return err("Internal server error");
  }
}

/**
 * POST /api/lanes
 *
 * Admin only. Creates a new lane in a space.
 *
 * Body:
 *   {
 *     space_id:   string,
 *     name:       string,
 *     sort_order?: number,  // default 0
 *     active?:    boolean,  // default true
 *     notes?:     string
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAdminContext();
    if (!ctx) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    const {
      space_id,
      name,
      sort_order = 0,
      active = true,
      notes = null,
    } = body as Record<string, unknown>;

    if (!isUuid(space_id)) {
      return badRequest("space_id is required and must be a valid UUID");
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return badRequest("name is required and must be a non-empty string");
    }
    if (typeof sort_order !== "number") {
      return badRequest("sort_order must be a number");
    }
    if (typeof active !== "boolean") {
      return badRequest("active must be a boolean");
    }
    if (notes !== null && typeof notes !== "string") {
      return badRequest("notes must be a string");
    }

    // Confirm space exists
    const { data: space, error: spaceErr } = await ctx.supabase
      .from("spaces")
      .select("id")
      .eq("id", space_id)
      .single();

    if (spaceErr || !space) return notFound("Space");

    const { data, error } = await ctx.supabase
      .from("lanes")
      .insert({ space_id, name: name.trim(), sort_order, active, notes: notes ?? null })
      .select("id, space_id, name, sort_order, active, notes")
      .single();

    if (error) {
      console.error("[lanes] POST insert error", error.message);
      return err("Failed to create lane");
    }

    return ok(data as LaneDetail, undefined, 201);
  } catch (e) {
    console.error("[lanes] POST unexpected error", e);
    return err("Internal server error");
  }
}
