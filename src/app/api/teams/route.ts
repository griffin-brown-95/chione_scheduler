import { ok, err, unauthorized, forbidden } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";

/**
 * GET /api/teams
 *
 * Admin only — returns all teams.
 * Team users don't need a list of all teams; they only interact with their own.
 */
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
      console.error("[teams] query error", error.message);
      return err("Failed to fetch teams");
    }

    return ok(data, { total: count ?? 0 });
  } catch (e) {
    console.error("[teams] unexpected error", e);
    return err("Internal server error");
  }
}
