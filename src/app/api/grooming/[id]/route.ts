import { type NextRequest } from "next/server";
import { ok, err, unauthorized, notFound } from "@/lib/api/response";
import { getAdminContext } from "@/lib/api/auth";

// ---------------------------------------------------------------------------
// DELETE /api/grooming/[id]
//
// Admin only.  Permanently removes a grooming schedule entry.
// Returns the deleted record's id and scheduled_date for confirmation.
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAdminContext();
    if (!ctx) return unauthorized();

    const { id } = await params;

    // Verify existence before deleting so we can return a clear 404
    const { data: existing, error: fetchErr } = await ctx.supabase
      .from("grooming_schedules")
      .select("id, scheduled_date, space_id, lane_id")
      .eq("id", id)
      .single();

    if (fetchErr) {
      if (fetchErr.code === "PGRST116") return notFound("Grooming schedule");
      console.error("[grooming/[id]] DELETE fetch error", fetchErr.message);
      return err("Failed to fetch grooming schedule");
    }

    const { error: deleteErr } = await ctx.supabase
      .from("grooming_schedules")
      .delete()
      .eq("id", id);

    if (deleteErr) {
      console.error("[grooming/[id]] DELETE error", deleteErr.message);
      return err("Failed to delete grooming schedule");
    }

    return ok({
      id:             existing.id,
      scheduled_date: existing.scheduled_date,
      space_id:       existing.space_id,
      lane_id:        existing.lane_id,
      deleted:        true,
    });
  } catch (e) {
    console.error("[grooming/[id]] DELETE unexpected error", e);
    return err("Internal server error");
  }
}
