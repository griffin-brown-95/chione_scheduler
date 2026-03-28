import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/api/auth";
import type { BookingStatus, TeamStatus } from "@/lib/api/types";

function formatCurrency(cents: number): string {
  return (
    "$" +
    Math.round(cents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

type BadgeVariant =
  | "blue"
  | "green"
  | "gold"
  | "red"
  | "gray"
  | "teal"
  | "purple";

function getBadgeStyle(variant: BadgeVariant) {
  const styles: Record<BadgeVariant, { background: string; color: string }> = {
    blue: { background: "var(--navy-pale)", color: "var(--navy)" },
    green: { background: "var(--green-bg)", color: "var(--green)" },
    gold: { background: "var(--gold-bg)", color: "var(--gold)" },
    red: { background: "var(--red-bg)", color: "var(--red)" },
    gray: { background: "var(--surface2)", color: "var(--text-muted)" },
    teal: { background: "var(--teal-bg)", color: "var(--teal)" },
    purple: { background: "var(--purple-bg)", color: "var(--purple)" },
  };
  return styles[variant];
}

function teamStatusVariant(status: TeamStatus): BadgeVariant {
  switch (status) {
    case "residential":
      return "blue";
    case "local":
      return "teal";
    case "out_of_state":
      return "gold";
    case "international":
      return "purple";
    default:
      return "gray";
  }
}

function bookingStatusVariant(status: BookingStatus): BadgeVariant {
  switch (status) {
    case "active":
      return "green";
    case "blocked":
      return "red";
    case "cancelled":
      return "gray";
    default:
      return "gray";
  }
}

function Badge({
  label,
  variant,
}: {
  label: string;
  variant: BadgeVariant;
}) {
  const style = getBadgeStyle(variant);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 15,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: "var(--text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 26,
          fontWeight: 500,
          lineHeight: 1,
          color: "var(--text)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--text-hint)",
            marginTop: 3,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

interface BookingRow {
  id: string;
  booking_date: string;
  status: BookingStatus;
  total_cost_cents: number;
  lane: { name: string } | null;
  space: { name: string } | null;
  team: { name: string; status: TeamStatus } | null;
  group: { name: string } | null;
}

interface TeamRow {
  id: string;
  name: string;
  status: TeamStatus;
  active: boolean;
}

export default async function DashboardPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const isAdmin = ctx.profile.role === "admin";

  // Fetch recent bookings
  let bookingsQuery = ctx.supabase
    .from("bookings")
    .select(
      "id, booking_date, status, total_cost_cents, lane:lanes(name), space:spaces(name), team:teams(name,status), group:groups(name)"
    )
    .order("booking_date", { ascending: false })
    .limit(8);

  if (!isAdmin && ctx.profile.team_id) {
    bookingsQuery = bookingsQuery.eq("team_id", ctx.profile.team_id);
  }

  const { data: bookingsRaw } = await bookingsQuery;
  const bookings = (bookingsRaw ?? []) as unknown as BookingRow[];

  // Admin-only: teams list
  let teams: TeamRow[] = [];
  if (isAdmin) {
    const { data: teamsData } = await ctx.supabase
      .from("teams")
      .select("id, name, status, active")
      .order("name");
    teams = (teamsData ?? []) as TeamRow[];
  }

  // Compute stats
  const activeBookings = bookings.filter((b) => b.status === "active");
  const blockedBookings = bookings.filter((b) => b.status === "blocked");
  const totalRevenue = bookings.reduce(
    (sum, b) => sum + (b.total_cost_cents ?? 0),
    0
  );
  const activeTeams = teams.filter((t) => t.active).length;

  // My groups count (for team users)
  let myGroupsCount = 0;
  if (!isAdmin && ctx.profile.team_id) {
    const { count } = await ctx.supabase
      .from("groups")
      .select("id", { count: "exact", head: true })
      .eq("team_id", ctx.profile.team_id);
    myGroupsCount = count ?? 0;
  }

  const tdStyle: React.CSSProperties = {
    padding: "9px 13px",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
    fontSize: 13,
    color: "var(--text)",
  };

  const thStyle: React.CSSProperties = {
    background: "var(--bg)",
    padding: "8px 13px",
    textAlign: "left",
    fontSize: 10.5,
    fontWeight: 500,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Topbar */}
      <div
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "11px 26px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
          Dashboard
        </h2>
      </div>

      {/* Content */}
      <div style={{ padding: "22px 26px", flex: 1 }}>
        {/* Stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isAdmin
              ? "repeat(4, 1fr)"
              : "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {isAdmin ? (
            <>
              <StatCard
                label="Total Active Bookings"
                value={String(activeBookings.length)}
                sub="from recent records"
              />
              <StatCard
                label="Total Revenue"
                value={formatCurrency(totalRevenue)}
                sub="from recent records"
              />
              <StatCard
                label="Blocked Slots"
                value={String(blockedBookings.length)}
                sub="from recent records"
              />
              <StatCard
                label="Active Teams"
                value={String(activeTeams)}
                sub="registered teams"
              />
            </>
          ) : (
            <>
              <StatCard
                label="My Active Bookings"
                value={String(activeBookings.length)}
                sub="recent bookings"
              />
              <StatCard
                label="My Spend"
                value={formatCurrency(totalRevenue)}
                sub="recent bookings"
              />
              <StatCard
                label="My Groups"
                value={String(myGroupsCount)}
                sub="athlete groups"
              />
            </>
          )}
        </div>

        {/* Recent Bookings */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              padding: "13px 18px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {isAdmin ? "Recent Bookings" : "My Recent Bookings"}
            </h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            {bookings.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "44px 20px",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                No bookings found.
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Space</th>
                    <th style={thStyle}>Lane</th>
                    {isAdmin && <th style={thStyle}>Team</th>}
                    <th style={thStyle}>Group</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b, idx) => (
                    <tr
                      key={b.id}
                      style={{
                        background:
                          idx % 2 === 0 ? "transparent" : "transparent",
                      }}
                    >
                      <td style={tdStyle}>
                        <span
                          style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 12,
                          }}
                        >
                          {b.booking_date}
                        </span>
                      </td>
                      <td style={tdStyle}>{b.space?.name ?? "—"}</td>
                      <td style={tdStyle}>{b.lane?.name ?? "—"}</td>
                      {isAdmin && (
                        <td style={tdStyle}>
                          {b.team ? (
                            <div>
                              <div>{b.team.name}</div>
                              <Badge
                                label={b.team.status.replace(/_/g, " ")}
                                variant={teamStatusVariant(b.team.status)}
                              />
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-hint)" }}>—</span>
                          )}
                        </td>
                      )}
                      <td style={tdStyle}>{b.group?.name ?? "—"}</td>
                      <td style={tdStyle}>
                        <Badge
                          label={b.status}
                          variant={bookingStatusVariant(b.status)}
                        />
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 12,
                        }}
                      >
                        {b.total_cost_cents > 0
                          ? formatCurrency(b.total_cost_cents)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Teams table (admin only) */}
        {isAdmin && teams.length > 0 && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "13px 18px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Teams
              </h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.id}>
                      <td style={tdStyle}>{t.name}</td>
                      <td style={tdStyle}>
                        <Badge
                          label={t.status.replace(/_/g, " ")}
                          variant={teamStatusVariant(t.status)}
                        />
                      </td>
                      <td style={tdStyle}>
                        <Badge
                          label={t.active ? "Active" : "Inactive"}
                          variant={t.active ? "green" : "gray"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
