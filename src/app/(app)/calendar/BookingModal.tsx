"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/Toast";
import { fetchGroupsForTeam } from "./actions";
import type { SpaceWithDetails, TeamOption, GroupOption } from "./page";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BookingModalProps {
  spaces: SpaceWithDetails[];
  teams: TeamOption[];
  myTeamId: string | null;
  myGroups: GroupOption[];
  role: "admin" | "team";
  initialLaneId?: string | null;
  initialSpaceId?: string | null;
  initialDate?: string | null;
  initialSlotId?: string | null;
  onClose: () => void;
  onCreated: (newBooking: unknown) => void;
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 500,
  color: "var(--text-muted)",
  marginBottom: 4,
  letterSpacing: "0.02em",
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
// Component
// ---------------------------------------------------------------------------

export default function BookingModal({
  spaces,
  teams,
  myTeamId,
  myGroups,
  role,
  initialLaneId,
  initialSpaceId,
  initialDate,
  initialSlotId,
  onClose,
  onCreated,
}: BookingModalProps) {
  const { toast } = useToast();
  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Derived initial space from lane ─────────────────────────────────────
  const resolvedInitialSpaceId = initialSpaceId ?? null;

  // ── State ────────────────────────────────────────────────────────────────
  const [spaceId, setSpaceId] = useState(resolvedInitialSpaceId ?? "");
  const [laneId, setLaneId] = useState(initialLaneId ?? "");
  const [date, setDate] = useState(initialDate ?? todayStr);
  const [slotId, setSlotId] = useState(initialSlotId ?? "");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [teamId, setTeamId] = useState(role === "team" ? (myTeamId ?? "") : "");
  const [groupId, setGroupId] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costPreview, setCostPreview] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<GroupOption[]>(
    role === "team" ? myGroups : []
  );
  const [ratesLoading, setRatesLoading] = useState(false);

  // ── Derived: selected space data ─────────────────────────────────────────
  const selectedSpace = spaces.find((s) => s.id === spaceId) ?? null;
  const isRink = selectedSpace?.space_type === "rink";
  const availableLanes = selectedSpace
    ? selectedSpace.lanes.filter((l) => l.active).sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const availableSlots = selectedSpace
    ? selectedSpace.time_slots.filter((s) => s.active).sort((a, b) => a.sort_order - b.sort_order)
    : [];

  // ── When space changes → reset lane/slot ────────────────────────────────
  useEffect(() => {
    if (!initialLaneId) setLaneId("");
    if (!initialSlotId) setSlotId("");
    setCostPreview(null);
    setConflictWarning(false);
  }, [spaceId, initialLaneId, initialSlotId]);

  // ── Load groups when team changes (admin) ────────────────────────────────
  useEffect(() => {
    if (role !== "admin" || !teamId) {
      if (role !== "team") setAvailableGroups([]);
      return;
    }
    let cancelled = false;
    fetchGroupsForTeam(teamId).then((groups) => {
      if (!cancelled) setAvailableGroups(groups);
    });
    return () => {
      cancelled = true;
    };
  }, [teamId, role]);

  // ── Reset group when groups change ──────────────────────────────────────
  useEffect(() => {
    setGroupId("");
  }, [availableGroups]);

  // ── Cost preview ─────────────────────────────────────────────────────────
  const fetchCostPreview = useCallback(async () => {
    if (!laneId || !teamId || isBlocked) {
      setCostPreview(null);
      return;
    }
    const selectedTeam = teams.find((t) => t.id === teamId);
    if (!selectedTeam) {
      setCostPreview(null);
      return;
    }
    setRatesLoading(true);
    try {
      const res = await fetch(
        `/api/lanes/${laneId}/rates?team_status=${selectedTeam.status}`
      );
      if (res.ok) {
        const json = await res.json() as { data?: Array<{ rate_cents_per_slot: number | null; rate_cents_per_15min: number | null; effective_to: string | null }> };
        const rates = json.data ?? [];
        const active = rates.find((r) => r.effective_to === null);
        if (active) {
          if (active.rate_cents_per_slot != null) {
            const dollars = Math.round(active.rate_cents_per_slot / 100);
            setCostPreview(
              `$${dollars.toLocaleString()} / session (${selectedTeam.status.replace(/_/g, " ")} rate)`
            );
          } else if (active.rate_cents_per_15min != null) {
            const per15 = Math.round(active.rate_cents_per_15min / 100);
            setCostPreview(
              `$${per15.toLocaleString()} per 15 min (${selectedTeam.status.replace(/_/g, " ")} rate)`
            );
          } else {
            setCostPreview(null);
          }
        } else {
          setCostPreview(null);
        }
      }
    } catch {
      setCostPreview(null);
    } finally {
      setRatesLoading(false);
    }
  }, [laneId, teamId, isBlocked, teams]);

  useEffect(() => {
    fetchCostPreview();
  }, [fetchCostPreview]);

  // ── Conflict check ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!laneId || !date || (!slotId && !isRink)) {
      setConflictWarning(false);
      return;
    }
    const controller = new AbortController();
    let params = `lane_id=${laneId}&booking_date=${date}`;
    if (!isRink && slotId) params += `&slot_id=${slotId}`;

    fetch(`/api/bookings?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json: { data?: unknown[] }) => {
        const items = json.data ?? [];
        setConflictWarning(Array.isArray(items) && items.length > 0);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [laneId, date, slotId, isRink]);

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError(null);
    if (!spaceId || !laneId || !date) {
      setError("Please fill in Space, Lane, and Date.");
      return;
    }
    if (!isRink && !slotId && !isBlocked) {
      setError("Please select a time slot.");
      return;
    }
    if (isRink && (!startTime || !endTime)) {
      setError("Please enter start and end time.");
      return;
    }
    if (!isBlocked && !teamId) {
      setError("Please select a team.");
      return;
    }

    const body: Record<string, unknown> = {
      lane_id: laneId,
      booking_date: date,
      status: isBlocked ? "blocked" : "active",
    };
    if (!isRink && slotId) body.slot_id = slotId;
    if (isRink && startTime) body.start_time = startTime;
    if (isRink && endTime) body.end_time = endTime;
    if (!isBlocked && teamId) body.team_id = teamId;
    if (groupId) body.group_id = groupId;
    if (isBlocked && blockReason) body.block_reason = blockReason;

    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: unknown; error?: string };
      if (!res.ok) {
        if (res.status === 409) {
          setError("This slot is already booked. Please choose another.");
        } else {
          setError(json.error ?? "Failed to create booking.");
        }
        return;
      }
      toast("Booking created!", "success");
      onCreated(json.data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
          maxWidth: 560,
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
            New Booking
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
          {error && (
            <div
              style={{
                padding: "9px 13px",
                borderRadius: "var(--r)",
                fontSize: 13,
                marginBottom: 12,
                background: "var(--red-bg)",
                color: "var(--red)",
                border: "1px solid var(--red-border)",
              }}
            >
              {error}
            </div>
          )}

          {/* Row 1: Space + Lane */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 13,
            }}
          >
            <div>
              <label style={labelStyle}>Space</label>
              <select
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">Select space…</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Lane</label>
              <select
                value={laneId}
                onChange={(e) => setLaneId(e.target.value)}
                disabled={!spaceId}
                style={{ ...inputStyle, cursor: spaceId ? "pointer" : "not-allowed" }}
              >
                <option value="">Select lane…</option>
                {availableLanes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Date + Slot / Time */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 13,
            }}
          >
            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            {isRink ? (
              <>
                <div>
                  <label style={labelStyle}>Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </>
            ) : (
              <div>
                <label style={labelStyle}>Time Slot</label>
                <select
                  value={slotId}
                  onChange={(e) => setSlotId(e.target.value)}
                  disabled={!spaceId}
                  style={{ ...inputStyle, cursor: spaceId ? "pointer" : "not-allowed" }}
                >
                  <option value="">Select slot…</option>
                  {availableSlots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* End time row for rink */}
          {isRink && (
            <div style={{ marginBottom: 13 }}>
              <label style={labelStyle}>End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {/* Row 3: Team + Group */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 13,
            }}
          >
            <div>
              <label style={labelStyle}>Team</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                disabled={role !== "admin" || isBlocked}
                style={{
                  ...inputStyle,
                  cursor: role === "admin" && !isBlocked ? "pointer" : "not-allowed",
                }}
              >
                <option value="">Select team…</option>
                {role === "admin"
                  ? teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))
                  : myTeamId
                  ? teams
                      .filter((t) => t.id === myTeamId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))
                  : null}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Group</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                disabled={!teamId || isBlocked}
                style={{
                  ...inputStyle,
                  cursor: teamId && !isBlocked ? "pointer" : "not-allowed",
                }}
              >
                <option value="">Select group…</option>
                {availableGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Admin-only: blocked toggle */}
          {role === "admin" && (
            <>
              <div style={{ marginBottom: 6 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--text)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isBlocked}
                    onChange={(e) => {
                      setIsBlocked(e.target.checked);
                      if (e.target.checked) {
                        setTeamId("");
                        setCostPreview(null);
                      }
                    }}
                    style={{ width: 15, height: 15, accentColor: "var(--navy)" }}
                  />
                  Mark as Blocked (admin only — maintenance/event)
                </label>
              </div>
              {isBlocked && (
                <div style={{ marginBottom: 13 }}>
                  <label style={labelStyle}>Reason</label>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="e.g. Maintenance"
                    style={inputStyle}
                  />
                </div>
              )}
            </>
          )}

          {/* Cost preview */}
          {costPreview && !ratesLoading && (
            <div
              style={{
                padding: "9px 13px",
                borderRadius: "var(--r)",
                fontSize: 13,
                marginBottom: 12,
                background: "var(--navy-pale)",
                color: "var(--navy)",
                border: "1px solid rgba(74,127,165,.25)",
              }}
            >
              Estimated cost:{" "}
              <strong style={{ fontFamily: "'DM Mono', monospace" }}>
                {costPreview}
              </strong>
            </div>
          )}

          {/* Conflict warning */}
          {conflictWarning && (
            <div
              style={{
                padding: "9px 13px",
                borderRadius: "var(--r)",
                fontSize: 13,
                marginBottom: 12,
                background: "var(--gold-bg)",
                color: "var(--gold)",
                border: "1px solid var(--gold-border)",
              }}
            >
              This lane/slot is already booked on that date.
            </div>
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
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              ...primaryBtnStyle,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Booking…" : "✓ Book Lane"}
          </button>
        </div>
      </div>
    </div>
  );
}
