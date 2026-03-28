"use client";

import React, { useState, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useToast } from "@/components/Toast";
import type { ScheduleData } from "@/lib/api/types";
import { fetchWeekSchedule } from "./actions";
import BookingModal from "./BookingModal";
import ViewBookingModal from "./ViewBookingModal";
import type { SpaceWithDetails, TeamOption, GroupOption } from "./page";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CalendarClientProps {
  initialWeekDates: string[];
  initialSchedule: (ScheduleData | null)[];
  spaces: SpaceWithDetails[];
  teams: TeamOption[];
  myTeamId: string | null;
  myGroups: GroupOption[];
  role: "admin" | "team";
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const BOOKING_COLORS = [
  { bg: "#EFF6FF", color: "#1E40AF", border: "rgba(30,64,175,.2)" },
  { bg: "#F0FDF4", color: "#065F46", border: "rgba(6,95,70,.2)" },
  { bg: "#FFFBEB", color: "#92400E", border: "rgba(146,64,14,.2)" },
  { bg: "#ECFDF5", color: "#0F5E4E", border: "rgba(15,94,78,.2)" },
  { bg: "#F5F3FF", color: "#4C1D95", border: "rgba(76,29,149,.2)" },
  { bg: "#F8FAFC", color: "#475569", border: "rgba(71,85,105,.2)" },
];
const MINE_COLOR = {
  bg: "#FFF7ED",
  color: "#9A3412",
  border: "rgba(154,58,18,.25)",
};
const BLOCKED_COLOR = {
  bg: "#FEF2F2",
  color: "#991B1B",
  border: "rgba(153,27,27,.2)",
};

function getTeamColor(teamId: string | null, myTeamId: string | null) {
  if (!teamId) return BLOCKED_COLOR;
  if (teamId === myTeamId) return MINE_COLOR;
  const hash = teamId
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return BOOKING_COLORS[hash % BOOKING_COLORS.length];
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatCurrency(cents: number): string {
  return "$" + Math.round(cents / 100).toLocaleString();
}

function formatDateRange(weekDates: string[]): string {
  if (!weekDates.length) return "";
  const from = new Date(weekDates[0] + "T00:00:00");
  const to = new Date(weekDates[weekDates.length - 1] + "T00:00:00");
  const fromStr = from.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const toStr = to.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fromStr} – ${toStr}`;
}

function getCellBooking(
  schedule: Map<string, ScheduleData>,
  date: string,
  laneId: string,
  slotId: string | null
) {
  const dayData = schedule.get(date);
  if (!dayData) return null;
  for (const space of dayData.spaces) {
    for (const lane of space.lanes) {
      if (lane.id !== laneId) continue;
      for (const booking of lane.bookings) {
        if (slotId ? booking.slot_id === slotId : booking.slot_id === null) {
          return booking;
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Button style helpers
// ---------------------------------------------------------------------------

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
// Legend items
// ---------------------------------------------------------------------------

type LegendItem = { label: string; bg: string; color: string; border: string };

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CalendarClient({
  initialWeekDates,
  initialSchedule,
  spaces,
  teams,
  myTeamId,
  myGroups,
  role,
}: CalendarClientProps) {
  const { toast } = useToast();
  const todayStr = new Date().toISOString().slice(0, 10);

  // ── State ────────────────────────────────────────────────────────────────
  const [weekDates, setWeekDates] = useState<string[]>(initialWeekDates);
  const [schedule, setSchedule] = useState<Map<string, ScheduleData>>(() => {
    const map = new Map<string, ScheduleData>();
    initialSchedule.forEach((r, i) => {
      if (r) map.set(initialWeekDates[i], r);
    });
    return map;
  });
  const [loading, setLoading] = useState(false);
  const [filterSpaceId, setFilterSpaceId] = useState("");
  const [bookingTarget, setBookingTarget] = useState<{
    laneId: string;
    spaceId: string;
    date: string;
    slotId: string | null;
  } | null | "open">(null);
  const [viewBookingId, setViewBookingId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  // ── Week navigation ──────────────────────────────────────────────────────
  const shiftWeek = useCallback(
    async (delta: number) => {
      const anchor = new Date(weekDates[0] + "T00:00:00");
      anchor.setDate(anchor.getDate() + delta * 7);
      const newDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(anchor);
        d.setDate(anchor.getDate() + i);
        return d.toISOString().slice(0, 10);
      });
      setLoading(true);
      try {
        const results = await fetchWeekSchedule(newDates);
        const map = new Map<string, ScheduleData>();
        results.forEach((r, i) => {
          if (r) map.set(newDates[i], r);
        });
        setSchedule(map);
        setWeekDates(newDates);
      } finally {
        setLoading(false);
      }
    },
    [weekDates]
  );

  // ── Refresh schedule ─────────────────────────────────────────────────────
  const refreshSchedule = useCallback(
    async (dates: string[]) => {
      const results = await fetchWeekSchedule(dates);
      const map = new Map<string, ScheduleData>();
      results.forEach((r, i) => {
        if (r) map.set(dates[i], r);
      });
      setSchedule(map);
    },
    []
  );

  // ── Drag and drop ────────────────────────────────────────────────────────
  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const srcId = result.source.droppableId; // "laneId__slotId__date"
    const dstId = result.destination.droppableId;
    if (srcId === dstId) return;

    const [toLaneId, toSlotId, toDate] = dstId.split("__");
    const [fromLaneId, fromSlotId, fromDate] = srcId.split("__");
    const bookingId = result.draggableId;

    const destBooking = getCellBooking(
      schedule,
      toDate,
      toLaneId,
      toSlotId === "null" ? null : toSlotId
    );
    if (destBooking) {
      toast("That slot is already booked.", "error");
      return;
    }

    const srcBooking = getCellBooking(
      schedule,
      fromDate,
      fromLaneId,
      fromSlotId === "null" ? null : fromSlotId
    );
    if (!srcBooking) return;

    const toLane = spaces
      .flatMap((s) => s.lanes)
      .find((l) => l.id === toLaneId);
    if (!toLane) return;

    try {
      const delRes = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      });
      if (!delRes.ok) {
        const json = await delRes.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error || "Failed to cancel booking"
        );
      }

      const body: Record<string, unknown> = {
        lane_id: toLaneId,
        booking_date: toDate,
        status: srcBooking.status,
      };
      if (toSlotId && toSlotId !== "null") {
        body.slot_id = toSlotId;
      }
      if (srcBooking.start_time && srcBooking.end_time) {
        body.start_time = srcBooking.start_time;
        body.end_time = srcBooking.end_time;
      }
      if (srcBooking.team?.id) body.team_id = srcBooking.team.id;
      if (srcBooking.group?.id) body.group_id = srcBooking.group.id;
      if (srcBooking.block_reason) body.block_reason = srcBooking.block_reason;
      if (srcBooking.notes) body.notes = srcBooking.notes;

      const createRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!createRes.ok) {
        const json = await createRes.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ||
            "Failed to create booking at new slot"
        );
      }

      toast("Booking moved.", "success");
      await refreshSchedule(weekDates);
    } catch (err) {
      toast((err as Error).message || "Failed to move booking.", "error");
      await refreshSchedule(weekDates);
    }
  }

  // ── Filtered spaces ──────────────────────────────────────────────────────
  const filteredSpaces = filterSpaceId
    ? spaces.filter((s) => s.id === filterSpaceId)
    : spaces;

  // ── Legend ───────────────────────────────────────────────────────────────
  const legendItems: LegendItem[] =
    role === "admin"
      ? [
          { label: "My Bookings", ...MINE_COLOR },
          { label: "Blocked", ...BLOCKED_COLOR },
        ]
      : [
          { label: "My Bookings", ...MINE_COLOR },
          { label: "Other Teams", ...BOOKING_COLORS[0] },
          { label: "Blocked", ...BLOCKED_COLOR },
        ];

  // ── Table rows ───────────────────────────────────────────────────────────
  const tableRows: React.ReactNode[] = [];

  filteredSpaces.forEach((space) => {
    const spaceSlots = space.time_slots
      .filter((s) => s.active)
      .sort((a, b) => a.sort_order - b.sort_order);
    const lanes = space.lanes
      .filter((l) => l.active)
      .sort((a, b) => a.sort_order - b.sort_order);

    lanes.forEach((lane, laneIdx) => {
      const isLastLane = laneIdx === lanes.length - 1;
      const rows = spaceSlots.length > 0 ? spaceSlots : [null];

      rows.forEach((slot, slotIdx) => {
        const isFirstSlot = slotIdx === 0;
        const isLastSlot = slotIdx === rows.length - 1;

        const laneTdBorderBottom =
          isLastLane && isLastSlot
            ? "2px solid var(--border-mid)"
            : "1px solid var(--border)";

        const slotTdBorderBottom =
          isLastSlot && isLastLane
            ? "2px solid var(--border-mid)"
            : isLastSlot
            ? "2px solid var(--border-mid)"
            : "1px solid var(--border)";

        const rowKey = `${lane.id}-${slot?.id ?? "rink"}`;

        tableRows.push(
          <tr key={rowKey}>
            {isFirstSlot && (
              <td
                rowSpan={rows.length}
                style={{
                  background: "var(--bg)",
                  borderRight: "2px solid var(--border-mid)",
                  borderBottom: laneTdBorderBottom,
                  position: "sticky",
                  left: 0,
                  zIndex: 10,
                  verticalAlign: "middle",
                  minWidth: 160,
                  maxWidth: 160,
                  padding: 0,
                }}
              >
                <div style={{ padding: "8px 12px" }}>
                  <div
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    {space.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 1,
                    }}
                  >
                    {lane.name}
                  </div>
                </div>
              </td>
            )}
            {/* Slot label column */}
            <td
              style={{
                background: "var(--bg)",
                borderRight: "2px solid var(--border-mid)",
                borderBottom: slotTdBorderBottom,
                position: "sticky",
                left: 0,
                zIndex: 10,
                padding: "5px 10px 5px 14px",
                minWidth: 160,
                maxWidth: 160,
                verticalAlign: "middle",
              }}
            >
              {slot && (
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {slot.label}
                </div>
              )}
            </td>
            {/* Day cells */}
            {weekDates.map((date) => {
              const isToday = date === todayStr;
              const booking = getCellBooking(
                schedule,
                date,
                lane.id,
                slot?.id ?? null
              );
              const isBlocked = booking?.status === "blocked";
              const canDrag =
                role === "admin" ||
                (booking?.team?.id === myTeamId && !isBlocked);
              const ck = `${lane.id}__${slot?.id ?? "null"}__${date}`;

              let cellBg = isToday ? "#FAFCFF" : "var(--surface)";
              if (isBlocked) cellBg = "#FFF5F5";

              return (
                <Droppable
                  key={ck}
                  droppableId={ck}
                  isDropDisabled={!!booking}
                >
                  {(provided, snapshot) => (
                    <td
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        borderRight: "1px solid var(--border)",
                        borderBottom: slotTdBorderBottom,
                        verticalAlign: "top",
                        padding: "5px 6px",
                        minWidth: 200,
                        background: snapshot.isDraggingOver
                          ? "var(--navy-pale)"
                          : cellBg,
                        position: "relative",
                        minHeight: 52,
                        outline: snapshot.isDraggingOver
                          ? "2px dashed var(--navy-light)"
                          : "none",
                        outlineOffset: -2,
                      }}
                      onMouseEnter={() => {
                        if (!booking) setHoveredCell(ck);
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {booking ? (
                        <Draggable
                          draggableId={booking.id}
                          index={0}
                          isDragDisabled={!canDrag}
                        >
                          {(dragProvided, dragSnapshot) => {
                            const color = getTeamColor(
                              booking.team?.id ?? null,
                              myTeamId
                            );
                            return (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                onClick={() => setViewBookingId(booking.id)}
                                style={{
                                  ...dragProvided.draggableProps.style,
                                  borderRadius: 6,
                                  padding: "6px 8px",
                                  cursor: "pointer",
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  lineHeight: 1.4,
                                  background: color.bg,
                                  color: color.color,
                                  border: `1.5px solid ${color.border}`,
                                  position: "relative",
                                  userSelect: "none",
                                  opacity: dragSnapshot.isDragging ? 0.8 : 1,
                                }}
                              >
                                {canDrag ? (
                                  <span
                                    {...dragProvided.dragHandleProps}
                                    style={{
                                      position: "absolute",
                                      top: 4,
                                      right: 5,
                                      opacity: 0.4,
                                      cursor: "grab",
                                      fontSize: 11,
                                      lineHeight: 1,
                                    }}
                                  >
                                    ⠿
                                  </span>
                                ) : (
                                  <span
                                    style={{ width: 0 }}
                                    {...dragProvided.dragHandleProps}
                                  />
                                )}
                                <div
                                  style={{ fontWeight: 600, fontSize: 12 }}
                                >
                                  {isBlocked
                                    ? "🚫 Blocked"
                                    : booking.team?.name}
                                </div>
                                {booking.group?.name && (
                                  <div
                                    style={{
                                      fontSize: 10.5,
                                      opacity: 0.8,
                                      marginTop: 1,
                                    }}
                                  >
                                    {booking.group.name}
                                  </div>
                                )}
                                <div
                                  style={{
                                    fontFamily: "'DM Mono', monospace",
                                    fontSize: 10,
                                    opacity: 0.75,
                                    marginTop: 2,
                                  }}
                                >
                                  {isBlocked
                                    ? booking.block_reason || ""
                                    : formatCurrency(booking.total_cost_cents)}
                                </div>
                              </div>
                            );
                          }}
                        </Draggable>
                      ) : hoveredCell === ck ? (
                        <button
                          onClick={() =>
                            setBookingTarget({
                              laneId: lane.id,
                              spaceId: space.id,
                              date,
                              slotId: slot?.id ?? null,
                            })
                          }
                          style={{
                            position: "absolute",
                            inset: 4,
                            borderRadius: 5,
                            background: "transparent",
                            border: "1.5px dashed var(--border-strong)",
                            color: "var(--text-hint)",
                            fontSize: 11,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                          onMouseEnter={(e) => {
                            const btn =
                              e.currentTarget as HTMLButtonElement;
                            btn.style.background = "var(--navy-pale)";
                            btn.style.borderColor = "var(--navy-light)";
                            btn.style.color = "var(--navy)";
                          }}
                          onMouseLeave={(e) => {
                            const btn =
                              e.currentTarget as HTMLButtonElement;
                            btn.style.background = "transparent";
                            btn.style.borderColor = "var(--border-strong)";
                            btn.style.color = "var(--text-hint)";
                          }}
                        >
                          + Book
                        </button>
                      ) : null}
                      {provided.placeholder}
                    </td>
                  )}
                </Droppable>
              );
            })}
          </tr>
        );
      });
    });
  });

  // ── Day headers ──────────────────────────────────────────────────────────
  const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  // ── Render ───────────────────────────────────────────────────────────────
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
          gap: 12,
        }}
      >
        <h2
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 15,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {role === "admin" ? "Gantt Calendar" : "Book a Lane"}
        </h2>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {spaces.length > 1 && (
            <select
              value={filterSpaceId}
              onChange={(e) => setFilterSpaceId(e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--r)",
                fontSize: 13,
                fontFamily: "'DM Sans', sans-serif",
                background: "var(--surface)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              <option value="">All Spaces</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => shiftWeek(-1)}
            style={ghostBtnStyle}
            disabled={loading}
          >
            ← Prev week
          </button>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              minWidth: 200,
              textAlign: "center",
            }}
          >
            {formatDateRange(weekDates)}
          </span>
          <button
            onClick={() => shiftWeek(1)}
            style={ghostBtnStyle}
            disabled={loading}
          >
            Next week →
          </button>
          <button
            onClick={() => setBookingTarget("open")}
            style={primaryBtnStyle}
          >
            + New Booking
          </button>
        </div>
      </div>

      {/* Content area */}
      <div style={{ padding: "14px 18px", flex: 1, position: "relative" }}>
        {/* Legend + hint */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {legendItems.map((item) => (
            <span
              key={item.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 20,
                  height: 10,
                  borderRadius: 3,
                  background: item.bg,
                  border: `1px solid ${item.border}`,
                }}
              />
              {item.label}
            </span>
          ))}
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "var(--text-hint)",
            }}
          >
            Click to book · Drag booking card to reschedule
          </span>
        </div>

        {/* Loading overlay */}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.65)",
              zIndex: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid var(--border)",
                borderTopColor: "var(--navy)",
                borderRadius: "50%",
                animation: "calSpin .7s linear infinite",
              }}
            />
            <style>{`@keyframes calSpin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Calendar table */}
        {filteredSpaces.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "44px 20px",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No spaces configured.
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div
              style={{
                overflow: "auto",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                background: "var(--surface)",
                maxHeight: "calc(100vh - 200px)",
              }}
            >
              <table
                style={{
                  borderCollapse: "collapse",
                  fontSize: 12,
                  width: "max-content",
                  tableLayout: "fixed",
                }}
              >
                <thead>
                  <tr>
                    {/* Frozen corner spanning lane + slot columns */}
                    <th
                      colSpan={2}
                      style={{
                        background: "var(--bg)",
                        borderRight: "2px solid var(--border-mid)",
                        borderBottom: "2px solid var(--border-mid)",
                        position: "sticky",
                        left: 0,
                        top: 0,
                        zIndex: 40,
                        padding: "8px 12px",
                        verticalAlign: "bottom",
                        minWidth: 160,
                        maxWidth: 320,
                        textAlign: "left",
                      }}
                    >
                      <small
                        style={{
                          fontSize: 10,
                          color: "var(--text-hint)",
                          fontWeight: 500,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        Space / Lane / Slot
                      </small>
                    </th>
                    {weekDates.map((date) => {
                      const d = new Date(date + "T00:00:00");
                      const isToday = date === todayStr;
                      const weekday = WEEKDAYS[d.getDay()];
                      const dayNum = d.getDate();
                      const month = MONTHS[d.getMonth()];
                      const year = d.getFullYear();
                      return (
                        <th
                          key={date}
                          style={{
                            background: isToday ? "#EBF3FB" : "var(--bg)",
                            borderBottom: "2px solid var(--border-mid)",
                            borderRight: "1px solid var(--border-mid)",
                            padding: "7px 8px",
                            textAlign: "center",
                            position: "sticky",
                            top: 0,
                            zIndex: 20,
                            minWidth: 200,
                            verticalAlign: "bottom",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 9.5,
                              color: "var(--text-muted)",
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              marginBottom: 1,
                            }}
                          >
                            {weekday}
                          </div>
                          <div
                            style={{
                              fontFamily: "'Syne', sans-serif",
                              fontSize: 22,
                              fontWeight: 700,
                              color: isToday ? "var(--navy)" : "var(--text)",
                              lineHeight: 1,
                            }}
                          >
                            {dayNum}
                          </div>
                          <div
                            style={{
                              fontSize: 9,
                              color: isToday
                                ? "var(--navy-light)"
                                : "var(--text-hint)",
                              marginTop: 1,
                            }}
                          >
                            {month} {year}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>{tableRows}</tbody>
              </table>
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Booking modal */}
      {bookingTarget !== null && (
        <BookingModal
          spaces={spaces}
          teams={teams}
          myTeamId={myTeamId}
          myGroups={myGroups}
          role={role}
          initialLaneId={
            bookingTarget !== "open" ? bookingTarget.laneId : null
          }
          initialDate={
            bookingTarget !== "open" ? bookingTarget.date : null
          }
          initialSlotId={
            bookingTarget !== "open" ? bookingTarget.slotId : null
          }
          initialSpaceId={
            bookingTarget !== "open" ? bookingTarget.spaceId : null
          }
          onClose={() => setBookingTarget(null)}
          onCreated={async () => {
            setBookingTarget(null);
            await refreshSchedule(weekDates);
          }}
        />
      )}

      {/* View booking modal */}
      {viewBookingId && (
        <ViewBookingModal
          bookingId={viewBookingId}
          role={role}
          myTeamId={myTeamId}
          onClose={() => setViewBookingId(null)}
          onCancelled={async () => {
            setViewBookingId(null);
            await refreshSchedule(weekDates);
          }}
        />
      )}
    </div>
  );
}
