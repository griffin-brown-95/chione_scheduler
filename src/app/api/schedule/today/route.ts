import { createServiceClient } from "@/lib/supabase/service";
import { ok, err } from "@/lib/api/response";
import { buildSchedule, todayIso } from "@/app/api/_lib/schedule";

/**
 * GET /api/schedule/today
 *
 * Returns today's full schedule across all spaces and lanes.
 * Public — no auth required. Designed for video boards that poll on a loop.
 */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const date = todayIso();

    const { data, dbError } = await buildSchedule(supabase, date);

    if (dbError) {
      console.error("[schedule/today]", dbError);
      return err("Failed to fetch schedule");
    }

    return ok(data, { date });
  } catch (e) {
    console.error("[schedule/today] unexpected error", e);
    return err("Internal server error");
  }
}
