import { type NextRequest } from "next/server";
import { ok, err, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { getAdminContext } from "@/lib/api/auth";
import type { InvoiceSummary } from "@/lib/api/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * GET /api/invoices?month=3&year=2025
 *
 * Admin only. Returns a one-row-per-team summary for the given month.
 * Useful for bulk invoicing / finance exports.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAdminContext();
    if (!ctx) {
      // Distinguish between unauthenticated and authenticated-but-not-admin
      const { getAuthContext } = await import("@/lib/api/auth");
      const base = await getAuthContext();
      return base ? forbidden() : unauthorized();
    }

    const now = new Date();
    const monthParam = req.nextUrl.searchParams.get("month");
    const yearParam  = req.nextUrl.searchParams.get("year");

    const month = monthParam ? parseInt(monthParam, 10) : now.getUTCMonth() + 1;
    const year  = yearParam  ? parseInt(yearParam,  10) : now.getUTCFullYear();

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return badRequest("Invalid month — must be 1–12");
    }
    if (!Number.isInteger(year) || year < 2020 || year > 2099) {
      return badRequest("Invalid year — must be between 2020 and 2099");
    }

    const pad      = (n: number) => String(n).padStart(2, "0");
    const firstDay = `${year}-${pad(month)}-01`;
    const lastDay  = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const label    = `${MONTH_NAMES[month - 1]} ${year}`;

    // ── All active teams ──────────────────────────────────────────────────
    const { data: teams, error: teamsErr } = await ctx.supabase
      .from("teams")
      .select("id, name, status")
      .eq("active", true)
      .order("name");

    if (teamsErr) {
      console.error("[invoices] teams query error", teamsErr.message);
      return err("Failed to fetch teams");
    }

    // ── Booking totals grouped by team_id for the period ─────────────────
    // Supabase/PostgREST doesn't expose GROUP BY natively, so we pull all
    // active bookings for the period and aggregate in JS. For a typical
    // month (<10k rows) this is fast. Add a DB view/function if it grows.
    const { data: bookings, error: bookingsErr } = await ctx.supabase
      .from("bookings")
      .select("team_id, total_cost_cents")
      .eq("status", "active")
      .gte("booking_date", firstDay)
      .lte("booking_date", lastDay);

    if (bookingsErr) {
      console.error("[invoices] bookings query error", bookingsErr.message);
      return err("Failed to fetch booking totals");
    }

    // Aggregate: team_id → { count, subtotal }
    const agg = new Map<string, { count: number; subtotal: number }>();
    for (const b of bookings ?? []) {
      if (!b.team_id) continue;
      const prev = agg.get(b.team_id) ?? { count: 0, subtotal: 0 };
      agg.set(b.team_id, {
        count:    prev.count + 1,
        subtotal: prev.subtotal + b.total_cost_cents,
      });
    }

    // ── Active discounts for the period ───────────────────────────────────
    const { data: discounts } = await ctx.supabase
      .from("team_discounts")
      .select("team_id, discount_percent")
      .lte("effective_from", lastDay)
      .or(`effective_to.is.null,effective_to.gte.${firstDay}`);

    // Keep only the most-recently-effective discount per team
    const discountMap = new Map<string, number>();
    for (const d of discounts ?? []) {
      if (!discountMap.has(d.team_id)) {
        discountMap.set(d.team_id, Number(d.discount_percent));
      }
    }

    // ── Build summaries ───────────────────────────────────────────────────
    const summaries: InvoiceSummary[] = (teams ?? []).map((team) => {
      const totals         = agg.get(team.id) ?? { count: 0, subtotal: 0 };
      const discountPct    = discountMap.get(team.id) ?? 0;
      const discountAmount = Math.round(totals.subtotal * discountPct / 100);
      const grandTotal     = totals.subtotal - discountAmount;

      return {
        team:              { id: team.id, name: team.name, status: team.status },
        period:            { month, year, label },
        booking_count:     totals.count,
        subtotal_cents:    totals.subtotal,
        discount_percent:  discountPct,
        grand_total_cents: grandTotal,
      };
    });

    return ok(summaries, { total: summaries.length, period: label });
  } catch (e) {
    console.error("[invoices] unexpected error", e);
    return err("Internal server error");
  }
}
