import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ok, err, badRequest } from "@/lib/api/response";
import { buildSchedule, todayIso, isValidDateParam } from "@/app/api/_lib/schedule";

/**
 * GET /api/spaces/[id]/schedule?date=YYYY-MM-DD
 *
 * Returns the schedule for a single space. Defaults to today when no
 * date query param is supplied.
 * Public — no auth required.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: spaceId } = await params;
    const dateParam = req.nextUrl.searchParams.get("date");
    const date = dateParam ?? todayIso();

    if (!isValidDateParam(date)) {
      return badRequest("Invalid date — expected YYYY-MM-DD");
    }

    const supabase = createServiceClient();
    const { data, dbError } = await buildSchedule(supabase, date, spaceId);

    if (dbError) {
      console.error("[spaces/[id]/schedule]", dbError);
      return err("Failed to fetch schedule");
    }

    // If the space wasn't found, data.spaces will be an empty array
    if (!data || data.spaces.length === 0) {
      return err("Space not found", 404);
    }

    // Unwrap the single-space result — callers asked for one space, not a list
    return ok({ date, space: data.spaces[0] }, { date, space_id: spaceId });
  } catch (e) {
    console.error("[spaces/[id]/schedule] unexpected error", e);
    return err("Internal server error");
  }
}
