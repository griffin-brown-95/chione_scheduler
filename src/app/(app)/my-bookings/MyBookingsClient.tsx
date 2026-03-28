"use client";

import React, { useState, useCallback } from "react";
import ViewBookingModal from "@/app/(app)/calendar/ViewBookingModal";
import type { BookingDetail, BookingStatus } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MyBookingsClientProps {
  initialBookings: BookingDetail[];
  initialTotal: number;
  teamId: string;
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

type BadgeVariant = "green" | "red" | "gray";

function bookingStatusVariant(status: BookingStatus): BadgeVariant {
  switch (status) {
    case "active": return "green";
    case "blocked": return "red";
    case "cancelled": return "gray";
    default: return "gray";
  }
}

function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
  const styles: Record<BadgeVariant, { background: string; color: string }> = {
    green: { background: "var(--green-bg)", color: "var(--green)" },
    red: { background: "var(--red-bg)", color: "var(--red)" },
    gray: { background: "var(--surface2)", color: "var(--text-muted)" },
  };
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
        ...styles[variant],
      }}
    >
      {label}
    </span>
  );
}

function formatCurrency(cents: number): string {
  return "$" + Math.round(cents / 100).toLocaleString();
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

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

const tdStyle: React.CSSProperties = {
  padding: "9px 13px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
  fontSize: 13,
  color: "var(--text)",
};

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MyBookingsClient({
  initialBookings,
  initialTotal,
  teamId,
}: MyBookingsClientProps) {
  const [bookings, setBookings] = useState<BookingDetail[]>(initialBookings);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Fetch page ───────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      team_id: teamId,
      limit: String(PAGE_SIZE),
      offset: String(p * PAGE_SIZE),
    });
    try {
      const res = await fetch(`/api/bookings?${params}`);
      const json = await res.json() as {
        data?: BookingDetail[];
        error?: string;
        meta?: { total?: number };
      };
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to load bookings.");
      } else {
        setBookings(json.data ?? []);
        setTotal(json.meta?.total ?? (json.data?.length ?? 0));
        setPage(p);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  // ── Modal handlers ───────────────────────────────────────────────────────
  function handleCancelled() {
    setSelectedId(null);
    fetchPage(page);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
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
            My Bookings
          </h2>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {loading ? "Loading…" : `${total.toLocaleString()} total`}
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: "22px 26px", flex: 1 }}>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
            }}
          >
            {/* Error */}
            {error && (
              <div
                style={{
                  padding: "12px 18px",
                  background: "var(--red-bg)",
                  color: "var(--red)",
                  border: "1px solid var(--red-border)",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 160,
                  gap: 10,
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    border: "3px solid var(--border)",
                    borderTopColor: "var(--navy)",
                    borderRadius: "50%",
                    animation: "mbSpin .7s linear infinite",
                  }}
                />
                <style>{`@keyframes mbSpin { to { transform: rotate(360deg); } }`}</style>
                Loading…
              </div>
            )}

            {/* Table */}
            {!loading && !error && (
              <div style={{ overflowX: "auto" }}>
                {bookings.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "48px 20px",
                      color: "var(--text-muted)",
                      fontSize: 13,
                    }}
                  >
                    No bookings yet. Head to{" "}
                    <a
                      href="/calendar"
                      style={{
                        color: "var(--navy)",
                        textDecoration: "underline",
                      }}
                    >
                      Book a Lane
                    </a>{" "}
                    to get started.
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
                        <th style={thStyle}>Slot</th>
                        <th style={thStyle}>Group</th>
                        <th style={thStyle}>Status</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedId(b.id)}
                          style={{ cursor: "pointer" }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.background =
                              "var(--surface2)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.background =
                              "transparent";
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
                          <td style={tdStyle}>
                            {b.time_slot?.label ??
                              (b.start_time
                                ? `${b.start_time}–${b.end_time}`
                                : "—")}
                          </td>
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
            )}

            {/* Pagination */}
            {!loading && !error && totalPages > 1 && (
              <div
                style={{
                  padding: "11px 18px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                <span>
                  Showing {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, total)} of{" "}
                  {total.toLocaleString()}
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => fetchPage(page - 1)}
                    disabled={page === 0}
                    style={{
                      padding: "4px 10px",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--r)",
                      background: "transparent",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      color: "var(--text-muted)",
                      cursor: page === 0 ? "not-allowed" : "pointer",
                      opacity: page === 0 ? 0.4 : 1,
                    }}
                  >
                    ‹ Prev
                  </button>
                  <span
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      color: "var(--text)",
                    }}
                  >
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => fetchPage(page + 1)}
                    disabled={page >= totalPages - 1}
                    style={{
                      padding: "4px 10px",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--r)",
                      background: "transparent",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      color: "var(--text-muted)",
                      cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
                      opacity: page >= totalPages - 1 ? 0.4 : 1,
                    }}
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking detail modal */}
      {selectedId && (
        <ViewBookingModal
          bookingId={selectedId}
          role="team"
          myTeamId={teamId}
          onClose={() => setSelectedId(null)}
          onCancelled={handleCancelled}
        />
      )}
    </>
  );
}
