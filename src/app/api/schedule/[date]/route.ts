import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ok, err, badRequest } from "@/lib/api/response";
import { buildSchedule, isValidDateParam } from "@/app/api/_lib/schedule";

/**
 * GET /api/schedule/[date]
 *
 * Returns the full schedule for any date (YYYY-MM-DD).
 * Public — no auth required. Designed for video boards and external consumers.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;

    if (!isValidDateParam(date)) {
      return badRequest("Invalid date — expected YYYY-MM-DD");
    }

    const supabase = createServiceClient();
    const { data, dbError } = await buildSchedule(supabase, date);

    if (dbError) {
      console.error("[schedule/[date]]", dbError);
      return err("Failed to fetch schedule");
    }

    return ok(data, { date });
  } catch (e) {
    console.error("[schedule/[date]] unexpected error", e);
    return err("Internal server error");
  }
}
