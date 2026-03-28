import { type NextRequest } from "next/server";
import { ok, err, unauthorized, forbidden, notFound, badRequest } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import type { InvoiceLineItem, TeamInvoice } from "@/lib/api/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * GET /api/invoices/[teamId]?month=3&year=2025
 *
 * Monthly invoice rollup for a team. Returns line items, subtotals, and
 * grand total with discount applied.
 *
 * Admins can fetch any team. Team users can only fetch their own team.
 * Defaults to the current UTC month/year if params are omitted.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return unauthorized();

    const { teamId } = await params;

    // Authorization: team users may only see their own invoice
    if (ctx.profile.role === "team" && ctx.profile.team_id !== teamId) {
      return forbidden();
    }

    // Parse + validate month/year
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

    // Compute first/last day of month (server-side, UTC)
    const pad = (n: number) => String(n).padStart(2, "0");
    const firstDay = `${year}-${pad(month)}-01`;
    const lastDay  = new Date(Date.UTC(year, month, 0)) // day 0 of next month = last day of this month
      .toISOString()
      .slice(0, 10);

    // ── Fetch team ────────────────────────────────────────────────────────
    const { data: team, error: teamErr } = await ctx.supabase
      .from("teams")
      .select("id, name, status, active")
      .eq("id", teamId)
      .single();

    if (teamErr || !team) return notFound("Team");

    // ── Fetch active discount for this team (if any) ──────────────────────
    const { data: discountRow } = await ctx.supabase
      .from("team_discounts")
      .select("discount_percent")
      .eq("team_id", teamId)
      .lte("effective_from", lastDay)
      .or(`effective_to.is.null,effective_to.gte.${firstDay}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    const discountPercent: number =
      discountRow ? Number(discountRow.discount_percent) : 0;

    // ── Fetch bookings for the period ─────────────────────────────────────
    const { data: bookings, error: bookingsErr } = await ctx.supabase
      .from("bookings")
      .select(
        `
        id,
        booking_date,
        slot_id,
        start_time,
        end_time,
        total_cost_cents,
        lane:lanes(id, name),
        space:spaces(id, name, space_type),
        group:groups(id, name),
        time_slot:time_slots(id, label)
      `
      )
      .eq("team_id", teamId)
      .eq("status", "active")
      .gte("booking_date", firstDay)
      .lte("booking_date", lastDay)
      .order("booking_date")
      .order("created_at");

    if (bookingsErr) {
      console.error("[invoices/[teamId]] bookings query error", bookingsErr.message);
      return err("Failed to fetch invoice data");
    }

    // ── Build line items ──────────────────────────────────────────────────
    const lineItems: InvoiceLineItem[] = (bookings ?? []).map((b) => {
      // Supabase returns FK objects directly; guard against array shape from
      // the JS client when the FK isn't a one-to-many.
      const lane      = Array.isArray(b.lane)       ? b.lane[0]       : b.lane;
      const space     = Array.isArray(b.space)      ? b.space[0]      : b.space;
      const group     = Array.isArray(b.group)      ? b.group[0]      : b.group;
      const timeSlot  = Array.isArray(b.time_slot)  ? b.time_slot[0]  : b.time_slot;

      // For rink bookings: break the stored total into per-15min unit rate
      let quantity = 1;
      let unitRateCents = b.total_cost_cents;

      if (
        space?.space_type === "rink" &&
        b.start_time != null &&
        b.end_time   != null
      ) {
        const [sh, sm] = b.start_time.split(":").map(Number);
        const [eh, em] = b.end_time.split(":").map(Number);
        const minutes  = (eh * 60 + em) - (sh * 60 + sm);
        quantity       = Math.max(1, Math.round(minutes / 15));
        unitRateCents  = Math.round(b.total_cost_cents / quantity);
      }

      const subtotalCents       = b.total_cost_cents;
      const discountAmountCents = Math.round(subtotalCents * discountPercent / 100);
      const totalCents          = subtotalCents - discountAmountCents;

      return {
        booking_id:            b.id,
        booking_date:          b.booking_date,
        space_name:            space?.name ?? "—",
        lane_name:             lane?.name  ?? "—",
        slot_label:            timeSlot?.label   ?? null,
        start_time:            b.start_time,
        end_time:              b.end_time,
        group_name:            group?.name ?? null,
        unit_rate_cents:       unitRateCents,
        quantity,
        subtotal_cents:        subtotalCents,
        discount_amount_cents: discountAmountCents,
        total_cents:           totalCents,
      };
    });

    // ── Aggregate totals ──────────────────────────────────────────────────
    const subtotalCents      = lineItems.reduce((s, l) => s + l.subtotal_cents, 0);
    const discountTotalCents = lineItems.reduce((s, l) => s + l.discount_amount_cents, 0);
    const grandTotalCents    = subtotalCents - discountTotalCents;

    const invoice: TeamInvoice = {
      team: {
        id:     team.id,
        name:   team.name,
        status: team.status,
        active: team.active,
      },
      period: {
        month,
        year,
        label: `${MONTH_NAMES[month - 1]} ${year}`,
      },
      discount_percent:    discountPercent,
      line_items:          lineItems,
      subtotal_cents:      subtotalCents,
      discount_total_cents: discountTotalCents,
      grand_total_cents:   grandTotalCents,
    };

    return ok(invoice, { total: lineItems.length });
  } catch (e) {
    console.error("[invoices/[teamId]] unexpected error", e);
    return err("Internal server error");
  }
}
