import { ok, err, unauthorized } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";

/**
 * GET /api/spaces
 *
 * Authenticated (any role). Returns all active spaces with their nested
 * lanes and time slots — the canonical reference dataset for the booking UI.
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    const { data, error, count } = await ctx.supabase
      .from("spaces")
      .select(
        `
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
      `,
        { count: "exact" }
      )
      .eq("active", true)
      .order("name")
      .order("sort_order", { referencedTable: "lanes" })
      .order("sort_order", { referencedTable: "time_slots" });

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
