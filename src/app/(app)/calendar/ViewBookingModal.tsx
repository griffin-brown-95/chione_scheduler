"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import type { BookingDetail, BookingStatus, TeamStatus } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ViewBookingModalProps {
  bookingId: string;
  role: "admin" | "team";
  myTeamId: string | null;
  onClose: () => void;
  onCancelled: () => void;
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-muted)",
};

const valueStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--r)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  color: "var(--text)",
  background: "var(--surface)",
  outline: "none",
};

const ghostBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "7px 13px",
  borderRadius: "var(--r)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid var(--border-strong)",
  background: "transparent",
  color: "var(--text)",
  whiteSpace: "nowrap",
  lineHeight: 1,
};

const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "7px 13px",
  borderRadius: "var(--r)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  border: "none",
  background: "var(--navy)",
  color: "#fff",
  whiteSpace: "nowrap",
  lineHeight: 1,
};

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
// Component
// ---------------------------------------------------------------------------

export default function ViewBookingModal({
  bookingId,
  role,
  myTeamId,
  onClose,
  onCancelled,
}: ViewBookingModalProps) {
  const { toast } = useToast();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  // ── Fetch booking on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then((json: { data?: BookingDetail; error?: string }) => {
        if (cancelled) return;
        if (json.error) {
          setFetchError(json.error);
        } else if (json.data) {
          setBooking(json.data);
          setNotes(json.data.notes ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setFetchError("Failed to load booking.");
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  // ── Cancel booking ───────────────────────────────────────────────────────
  async function handleCancel() {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Failed to cancel booking.", "error");
        return;
      }
      toast("Booking cancelled.", "success");
      onCancelled();
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setCancelLoading(false);
    }
  }

  // ── Save notes (admin) ───────────────────────────────────────────────────
  async function handleSaveNotes() {
    if (!booking) return;
    setSaveLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Failed to save changes.", "error");
        return;
      }
      toast("Changes saved.", "success");
      setBooking((prev) => (prev ? { ...prev, notes } : prev));
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaveLoading(false);
    }
  }

  // ── Permission checks ────────────────────────────────────────────────────
  const canCancel =
    booking &&
    (role === "admin" ||
      (booking.team_id === myTeamId && booking.status === "active"));

  const isOwn = booking?.team_id === myTeamId;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.38)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--r-xl)",
          boxShadow: "0 8px 48px rgba(0,0,0,.18)",
          width: "100%",
          maxWidth: 420,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "15px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            background: "var(--surface)",
            zIndex: 1,
          }}
        >
          <h3
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Booking Detail
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 20,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {!booking && !fetchError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 120,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  border: "3px solid var(--border)",
                  borderTopColor: "var(--navy)",
                  borderRadius: "50%",
                  animation: "viewSpin .7s linear infinite",
                }}
              />
              <style>{`@keyframes viewSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {fetchError && (
            <div
              style={{
                padding: "9px 13px",
                borderRadius: "var(--r)",
                fontSize: 13,
                background: "var(--red-bg)",
                color: "var(--red)",
                border: "1px solid var(--red-border)",
              }}
            >
              {fetchError}
            </div>
          )}

          {booking && (
            <>
              {/* Detail grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "7px 16px",
                  alignItems: "center",
                }}
              >
                <span style={labelStyle}>Status</span>
                <span>
                  <Badge
                    label={booking.status}
                    variant={bookingStatusVariant(booking.status)}
                  />
                </span>

                <span style={labelStyle}>Date</span>
                <span
                  style={{
                    ...valueStyle,
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                  }}
                >
                  {booking.booking_date}
                </span>

                <span style={labelStyle}>Space</span>
                <span style={valueStyle}>{booking.space?.name ?? "—"}</span>

                <span style={labelStyle}>Lane</span>
                <span style={valueStyle}>{booking.lane?.name ?? "—"}</span>

                <span style={labelStyle}>Time Slot</span>
                <span style={valueStyle}>
                  {booking.time_slot?.label ??
                    (booking.start_time
                      ? `${booking.start_time} – ${booking.end_time}`
                      : "—")}
                </span>

                <span style={labelStyle}>Team</span>
                <span style={valueStyle}>
                  {booking.team ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {booking.team.name}
                      <Badge
                        label={booking.team.status.replace(/_/g, " ")}
                        variant={teamStatusVariant(booking.team.status)}
                      />
                    </span>
                  ) : booking.status === "blocked" ? (
                    <Badge label="Blocked" variant="red" />
                  ) : (
                    "—"
                  )}
                </span>

                <span style={labelStyle}>Group</span>
                <span style={valueStyle}>{booking.group?.name ?? "—"}</span>

                <span style={labelStyle}>Cost</span>
                <span
                  style={{
                    ...valueStyle,
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                  }}
                >
                  {booking.total_cost_cents > 0
                    ? formatCurrency(booking.total_cost_cents)
                    : "—"}
                </span>

                {booking.block_reason && (
                  <>
                    <span style={labelStyle}>Reason</span>
                    <span style={valueStyle}>{booking.block_reason}</span>
                  </>
                )}
              </div>

              {/* Divider */}
              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid var(--border)",
                  margin: "14px 0",
                }}
              />

              {/* Notes field */}
              {(role === "admin" || isOwn) && (
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11.5,
                      fontWeight: 500,
                      color: "var(--text-muted)",
                      marginBottom: 4,
                    }}
                  >
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Add internal notes…"
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                      minHeight: 64,
                    }}
                  />
                  <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={handleSaveNotes}
                      disabled={saveLoading}
                      style={{
                        ...ghostBtnStyle,
                        fontSize: 12,
                        padding: "5px 10px",
                        opacity: saveLoading ? 0.7 : 1,
                      }}
                    >
                      {saveLoading ? "Saving…" : "Save Notes"}
                    </button>
                  </div>
                </div>
              )}

              {/* Cancel section */}
              {canCancel ? (
                <>
                  {confirmCancel && (
                    <div
                      style={{
                        padding: "9px 13px",
                        borderRadius: "var(--r)",
                        fontSize: 13,
                        marginBottom: 10,
                        background: "var(--red-bg)",
                        color: "var(--red)",
                        border: "1px solid var(--red-border)",
                      }}
                    >
                      Are you sure? This will permanently cancel the booking.
                    </div>
                  )}
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "7px 13px",
                      borderRadius: "var(--r)",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: cancelLoading ? "not-allowed" : "pointer",
                      border: "1px solid var(--red-border)",
                      background: "var(--red-bg)",
                      color: "var(--red)",
                      opacity: cancelLoading ? 0.7 : 1,
                    }}
                  >
                    {cancelLoading
                      ? "Cancelling…"
                      : confirmCancel
                      ? "Confirm Cancel"
                      : "🗑 Cancel Booking"}
                  </button>
                </>
              ) : (
                <div
                  style={{
                    padding: "9px 13px",
                    borderRadius: "var(--r)",
                    fontSize: 13,
                    background: "var(--navy-pale)",
                    color: "var(--navy)",
                    border: "1px solid rgba(74,127,165,.25)",
                  }}
                >
                  You can view but not edit bookings by other teams.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "13px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            position: "sticky",
            bottom: 0,
            background: "var(--surface)",
          }}
        >
          <button onClick={onClose} style={ghostBtnStyle}>
            Close
          </button>
          {role === "admin" && booking && booking.status !== "cancelled" && (
            <button
              onClick={handleSaveNotes}
              disabled={saveLoading}
              style={{
                ...primaryBtnStyle,
                opacity: saveLoading ? 0.7 : 1,
                cursor: saveLoading ? "not-allowed" : "pointer",
              }}
            >
              {saveLoading ? "Saving…" : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
