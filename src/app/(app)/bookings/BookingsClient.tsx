"use client";

import React, { useState, useEffect, useCallback } from "react";
import ViewBookingModal from "@/app/(app)/calendar/ViewBookingModal";
import type { BookingDetail, BookingStatus, TeamStatus } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterOption {
  id: string;
  name: string;
}

interface BookingsClientProps {
  spaces: FilterOption[];
  teams: FilterOption[];
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

type BadgeVariant = "blue" | "green" | "gold" | "red" | "gray" | "teal" | "purple";

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

function bookingStatusVariant(status: BookingStatus): BadgeVariant {
  switch (status) {
    case "active": return "green";
    case "blocked": return "red";
    case "cancelled": return "gray";
    default: return "gray";
  }
}

function teamStatusVariant(status: TeamStatus): BadgeVariant {
  switch (status) {
    case "residential": return "blue";
    case "local": return "teal";
    case "out_of_state": return "gold";
    case "international": return "purple";
    default: return "gray";
  }
}

function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
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

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--r)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  color: "var(--text)",
  background: "var(--surface)",
  outline: "none",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--r)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  color: "var(--text)",
  background: "var(--surface)",
  outline: "none",
};

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BookingsClient({ spaces, teams }: BookingsClientProps) {
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [teamId, setTeamId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  // Modal
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Fetch bookings ───────────────────────────────────────────────────────
  const fetchBookings = useCallback(async (overridePage?: number) => {
    const currentPage = overridePage ?? page;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (teamId) params.set("team_id", teamId);
    if (spaceId) params.set("space_id", spaceId);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(currentPage * PAGE_SIZE));

    try {
      const res = await fetch(`/api/bookings?${params}`);
      const json = await res.json() as {
        data?: BookingDetail[];
        error?: string;
        meta?: { total?: number };
      };
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to load bookings.");
        setBookings([]);
        setTotal(0);
      } else {
        setBookings(json.data ?? []);
        setTotal(json.meta?.total ?? (json.data?.length ?? 0));
      }
    } catch {
      setError("Network error. Please try again.");
      setBookings([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [teamId, spaceId, status, from, to, page]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // ── Filter handlers ──────────────────────────────────────────────────────
  function handleFilterChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setter(e.target.value);
      setPage(0);
    };
  }

  // ── Pagination ───────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function goPage(p: number) {
    setPage(p);
  }

  // ── Modal handlers ───────────────────────────────────────────────────────
  function handleCancelled() {
    setSelectedId(null);
    fetchBookings();
  }

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
            All Bookings
          </h2>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {loading ? "Loading…" : `${total.toLocaleString()} total`}
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: "22px 26px", flex: 1 }}>

          {/* Filters */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: "14px 18px",
              marginBottom: 16,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              gap: 12,
            }}
          >
            {/* Team filter */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Team
              </label>
              <select
                value={teamId}
                onChange={handleFilterChange(setTeamId)}
                style={{ ...selectStyle, minWidth: 160 }}
              >
                <option value="">All Teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Space filter */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Space
              </label>
              <select
                value={spaceId}
                onChange={handleFilterChange(setSpaceId)}
                style={{ ...selectStyle, minWidth: 140 }}
              >
                <option value="">All Spaces</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Status
              </label>
              <select
                value={status}
                onChange={handleFilterChange(setStatus)}
                style={{ ...selectStyle, minWidth: 120 }}
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Date range */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                From
              </label>
              <input
                type="date"
                value={from}
                onChange={handleFilterChange(setFrom)}
                style={inputStyle}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                To
              </label>
              <input
                type="date"
                value={to}
                onChange={handleFilterChange(setTo)}
                style={inputStyle}
              />
            </div>

            {/* Clear */}
            {(teamId || spaceId || status || from || to) && (
              <button
                onClick={() => {
                  setTeamId("");
                  setSpaceId("");
                  setStatus("");
                  setFrom("");
                  setTo("");
                  setPage(0);
                }}
                style={{
                  padding: "6px 12px",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--r)",
                  background: "transparent",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  alignSelf: "flex-end",
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Table */}
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

            {/* Loading spinner */}
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
                    animation: "bkSpin .7s linear infinite",
                  }}
                />
                <style>{`@keyframes bkSpin { to { transform: rotate(360deg); } }`}</style>
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
                    No bookings match the current filters.
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
                        <th style={thStyle}>Team</th>
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
                          <td style={tdStyle}>
                            {b.team ? (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                }}
                              >
                                <span>{b.team.name}</span>
                                <Badge
                                  label={b.team.status.replace(/_/g, " ")}
                                  variant={teamStatusVariant(b.team.status)}
                                />
                              </div>
                            ) : (
                              <span style={{ color: "var(--text-hint)" }}>—</span>
                            )}
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
                    onClick={() => goPage(page - 1)}
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
                    onClick={() => goPage(page + 1)}
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
          role="admin"
          myTeamId={null}
          onClose={() => setSelectedId(null)}
          onCancelled={handleCancelled}
        />
      )}
    </>
  );
}
