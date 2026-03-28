import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/api/auth";
import MyBookingsClient from "./MyBookingsClient";
import type { BookingDetail } from "@/lib/api/types";

export default async function MyBookingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.profile.role !== "team") redirect("/bookings");

  const teamId = ctx.profile.team_id;
  if (!teamId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            padding: "11px 26px",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <h2
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            My Bookings
          </h2>
        </div>
        <div style={{ padding: "22px 26px" }}>
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--r)",
              background: "var(--red-bg)",
              color: "var(--red)",
              border: "1px solid var(--red-border)",
              fontSize: 13,
            }}
          >
            Your account is not linked to a team. Contact an administrator.
          </div>
        </div>
      </div>
    );
  }

  // Initial server-side fetch (first page)
  const params = new URLSearchParams({
    team_id: teamId,
    limit: "50",
    offset: "0",
  });

  // We call the internal API via supabase directly here since we're server-side
  // (no fetch needed — query directly)
  const { data: bookingsRaw, count } = await ctx.supabase
    .from("bookings")
    .select(
      `id, lane_id, space_id, booking_date, slot_id, start_time, end_time,
       team_id, group_id, status, block_reason, total_cost_cents, notes,
       created_at, updated_at,
       lane:lanes(id, name), space:spaces(id, name, space_type),
       team:teams(id, name, status), group:groups(id, name),
       time_slot:time_slots(id, label, start_time, end_time, sort_order)`,
      { count: "exact" }
    )
    .eq("team_id", teamId)
    .order("booking_date", { ascending: false })
    .limit(50);

  const bookings = (bookingsRaw ?? []) as unknown as BookingDetail[];
  const total = count ?? bookings.length;

  return (
    <MyBookingsClient
      initialBookings={bookings}
      initialTotal={total}
      teamId={teamId}
    />
  );
}
