import { type NextRequest } from "next/server";
import { ok, err, unauthorized } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";

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
