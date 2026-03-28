import { type NextRequest } from "next/server";
import {
  ok,
  err,
  unauthorized,
  badRequest,
  notFound,
} from "@/lib/api/response";
import { getAuthContext, getAdminContext } from "@/lib/api/auth";
import { isDateStr, isTimeStr, isUuid, timeLt } from "@/app/api/_lib/validate";
import type { GroomingScheduleDetail } from "@/lib/api/types";

const GROOMING_SELECT =
  "id, space_id, lane_id, scheduled_date, start_time, end_time, groomer, notes, created_by, created_at, updated_at";

// ---------------------------------------------------------------------------
// GET /api/grooming
//
// Authenticated (any role).  Returns grooming schedule entries.
// Query params:
//   ?space_id=   — filter by space (recommended)
//   ?lane_id=    — filter by lane
//   ?from=       — start date inclusive (YYYY-MM-DD)
//   ?to=         — end date inclusive   (YYYY-MM-DD)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    const p       = req.nextUrl.searchParams;
    const spaceId = p.get("space_id");
    const laneId  = p.get("lane_id");
    const from    = p.get("from");
    const to      = p.get("to");

    if (spaceId && !isUuid(spaceId)) return badRequest("space_id must be a valid UUID");
    if (laneId  && !isUuid(laneId))  return badRequest("lane_id must be a valid UUID");
    if (from    && !isDateStr(from)) return badRequest("from must be a valid YYYY-MM-DD date");
    if (to      && !isDateStr(to))   return badRequest("to must be a valid YYYY-MM-DD date");

    let query = ctx.supabase
      .from("grooming_schedules")
      .select(GROOMING_SELECT, { count: "exact" })
      .order("scheduled_date", { ascending: true })
      .order("start_time",     { ascending: true });

    if (spaceId) query = query.eq("space_id",       spaceId);
    if (laneId)  query = query.eq("lane_id",        laneId);
    if (from)    query = query.gte("scheduled_date", from);
    if (to)      query = query.lte("scheduled_date", to);

    const { data, error, count } = await query;

    if (error) {
      console.error("[grooming] GET error", error.message);
      return err("Failed to fetch grooming schedules");
    }

    return ok(data as GroomingScheduleDetail[], { total: count ?? 0 });
  } catch (e) {
    console.error("[grooming] GET unexpected error", e);
    return err("Internal server error");
  }
}

// ---------------------------------------------------------------------------
// POST /api/grooming
//
// Admin only.  Creates a grooming block.
//
// Body:
//   {
//     space_id:       string,           // required
//     lane_id?:       string | null,    // null = entire space is being groomed
//     scheduled_date: "YYYY-MM-DD",
//     start_time:     "HH:MM",
//     end_time:       "HH:MM",
//     groomer?:       string,
//     notes?:         string
//   }
//
// Returns 201 with the new GroomingScheduleDetail.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAdminContext();
    if (!ctx) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    const {
      space_id,
      lane_id        = null,
      scheduled_date,
      start_time,
      end_time,
      groomer        = null,
      notes          = null,
    } = body as Record<string, unknown>;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!isUuid(space_id))          return badRequest("space_id must be a valid UUID");
    if (!isDateStr(scheduled_date)) return badRequest("scheduled_date must be a valid YYYY-MM-DD date");
    if (!isTimeStr(start_time))     return badRequest("start_time must be a valid 24-hour time (HH:MM)");
    if (!isTimeStr(end_time))       return badRequest("end_time must be a valid 24-hour time (HH:MM)");

    if (!timeLt(start_time as string, end_time as string)) {
      return badRequest("end_time must be after start_time");
    }

    if (lane_id !== null && !isUuid(lane_id)) {
      return badRequest("lane_id must be a valid UUID or null");
    }
    if (groomer !== null && typeof groomer !== "string") {
      return badRequest("groomer must be a string");
    }
    if (notes !== null && typeof notes !== "string") {
      return badRequest("notes must be a string");
    }

    // ── Confirm space exists ──────────────────────────────────────────────
    const { data: space, error: spaceErr } = await ctx.supabase
      .from("spaces")
      .select("id")
      .eq("id", space_id)
      .single();

    if (spaceErr || !space) return notFound("Space");

    // ── If lane_id provided, confirm it belongs to the space ──────────────
    if (lane_id !== null) {
      const { data: lane, error: laneErr } = await ctx.supabase
        .from("lanes")
        .select("id")
        .eq("id", lane_id)
        .eq("space_id", space_id)
        .single();

      if (laneErr || !lane) {
        return badRequest("lane_id does not belong to the specified space");
      }
    }

    // ── Insert ────────────────────────────────────────────────────────────
    const { data, error } = await ctx.supabase
      .from("grooming_schedules")
      .insert({
        space_id,
        lane_id:        lane_id  ?? null,
        scheduled_date,
        start_time,
        end_time,
        groomer:        groomer  ?? null,
        notes:          notes    ?? null,
        created_by:     ctx.user.id,
      })
      .select(GROOMING_SELECT)
      .single();

    if (error) {
      console.error("[grooming] POST insert error", error.message);
      return err("Failed to create grooming schedule");
    }

    return ok(data as GroomingScheduleDetail, undefined, 201);
  } catch (e) {
    console.error("[grooming] POST unexpected error", e);
    return err("Internal server error");
  }
}
