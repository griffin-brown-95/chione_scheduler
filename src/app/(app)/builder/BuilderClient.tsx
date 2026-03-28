"use client";

import React, { useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import type {
  SpaceDetail,
  LaneDetail,
  TimeSlotSummary,
  PricingRateDetail,
  SpaceType,
  SeasonType,
  TeamStatus,
} from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type BadgeVariant = "blue" | "green" | "gold" | "red" | "gray" | "teal" | "purple";

function getBadgeStyle(variant: BadgeVariant) {
  const styles: Record<BadgeVariant, { background: string; color: string }> = {
    blue:   { background: "var(--navy-pale)", color: "var(--navy)" },
    green:  { background: "var(--green-bg)", color: "var(--green)" },
    gold:   { background: "var(--gold-bg)", color: "var(--gold)" },
    red:    { background: "var(--red-bg)", color: "var(--red)" },
    gray:   { background: "var(--surface2)", color: "var(--text-muted)" },
    teal:   { background: "var(--teal-bg)", color: "var(--teal)" },
    purple: { background: "var(--purple-bg)", color: "var(--purple)" },
  };
  return styles[variant];
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

function formatDollars(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function parseDollars(val: string): number {
  return Math.round(parseFloat(val || "0") * 100);
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 500,
  color: "var(--text-muted)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: 4,
};

const ghostBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 12px",
  borderRadius: "var(--r)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid var(--border-strong)",
  background: "transparent",
  color: "var(--text)",
  whiteSpace: "nowrap",
};

const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "7px 14px",
  borderRadius: "var(--r)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  border: "none",
  background: "var(--navy)",
  color: "#fff",
  whiteSpace: "nowrap",
};

const dangerBtnStyle: React.CSSProperties = {
  ...ghostBtnStyle,
  border: "1px solid var(--red-border)",
  background: "var(--red-bg)",
  color: "var(--red)",
};

const TEAM_STATUS_TIERS: TeamStatus[] = [
  "residential",
  "local",
  "out_of_state",
  "international",
];

const TIER_LABELS: Record<TeamStatus, string> = {
  residential: "Residential",
  local: "Local",
  out_of_state: "Out-of-State",
  international: "International",
};

// ---------------------------------------------------------------------------
// Modal types
// ---------------------------------------------------------------------------

type ModalState =
  | { type: "none" }
  | { type: "add_space" }
  | { type: "edit_space"; space: SpaceDetail }
  | { type: "add_lane"; spaceId: string; spaceType: SpaceType }
  | { type: "edit_lane"; lane: LaneDetail & { currentRates?: Record<TeamStatus, number> }; spaceType: SpaceType }
  | { type: "rate_history"; lane: LaneDetail; spaceName: string; spaceType: SpaceType }
  | { type: "add_slot"; spaceId: string }
  | { type: "confirm_delete_lane"; laneId: string; laneName: string };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BuilderClientProps {
  initialSpaces: SpaceDetail[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BuilderClient({ initialSpaces }: BuilderClientProps) {
  const { toast } = useToast();
  const [spaces, setSpaces] = useState<SpaceDetail[]>(initialSpaces);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [saving, setSaving] = useState(false);

  // Rate history state
  const [rateHistory, setRateHistory] = useState<PricingRateDetail[]>([]);
  const [rateHistoryLoading, setRateHistoryLoading] = useState(false);

  // ── Refresh spaces from server ───────────────────────────────────────────
  const refreshSpaces = useCallback(async () => {
    const res = await fetch("/api/spaces?all=true");
    const json = await res.json() as { data?: SpaceDetail[] };
    if (json.data) setSpaces(json.data);
  }, []);

  // ── Space operations ─────────────────────────────────────────────────────

  async function handleSaveSpace(data: {
    name: string;
    space_type: SpaceType;
    season: SeasonType;
    active: boolean;
    notes: string;
    editId?: string;
  }) {
    setSaving(true);
    try {
      const url = data.editId ? `/api/spaces/${data.editId}` : "/api/spaces";
      const method = data.editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          space_type: data.space_type,
          season: data.season,
          active: data.active,
          notes: data.notes || null,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Failed to save space.", "error");
        return;
      }
      toast(data.editId ? "Space updated." : "Space created.", "success");
      setModal({ type: "none" });
      await refreshSpaces();
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveSpace(space: SpaceDetail) {
    setSaving(true);
    try {
      const res = await fetch(`/api/spaces/${space.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !space.active }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Failed to update space.", "error");
        return;
      }
      toast(space.active ? "Space archived." : "Space restored.", "success");
      await refreshSpaces();
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Lane operations ──────────────────────────────────────────────────────

  async function handleSaveLane(data: {
    spaceId: string;
    name: string;
    rates: Record<TeamStatus, string>;
    spaceType: SpaceType;
    editId?: string;
  }) {
    setSaving(true);
    try {
      // Step 1: create/update the lane itself
      const url = data.editId ? `/api/lanes/${data.editId}` : "/api/lanes";
      const method = data.editId ? "PUT" : "POST";
      const laneRes = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_id: data.spaceId, name: data.name }),
      });
      const laneJson = await laneRes.json() as { data?: LaneDetail; error?: string };
      if (!laneRes.ok) {
        toast(laneJson.error ?? "Failed to save lane.", "error");
        return;
      }

      const laneId = laneJson.data?.id;
      if (!laneId) {
        toast("Lane saved but ID not returned.", "error");
        return;
      }

      // Step 2: rotate rates for each tier
      const today = new Date().toISOString().slice(0, 10);
      for (const tier of TEAM_STATUS_TIERS) {
        const cents = parseDollars(data.rates[tier]);
        if (cents <= 0) continue;
        const rateBody =
          data.spaceType === "rink"
            ? { team_status: tier, rate_cents_per_15min: cents, effective_from: today }
            : { team_status: tier, rate_cents_per_slot: cents, effective_from: today };
        await fetch(`/api/lanes/${laneId}/rates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rateBody),
        });
      }

      toast(data.editId ? "Lane updated." : "Lane created.", "success");
      setModal({ type: "none" });
      await refreshSpaces();
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLane(laneId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/lanes/${laneId}`, { method: "DELETE" });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Failed to delete lane.", "error");
        return;
      }
      toast("Lane deleted.", "success");
      setModal({ type: "none" });
      await refreshSpaces();
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Rate history ─────────────────────────────────────────────────────────

  async function openRateHistory(lane: LaneDetail, space: SpaceDetail) {
    setRateHistoryLoading(true);
    setModal({ type: "rate_history", lane, spaceName: space.name, spaceType: space.space_type });
    try {
      const res = await fetch(`/api/lanes/${lane.id}/rates`);
      const json = await res.json() as { data?: PricingRateDetail[] };
      setRateHistory(json.data ?? []);
    } catch {
      setRateHistory([]);
    } finally {
      setRateHistoryLoading(false);
    }
  }

  async function handleAddRate(data: {
    laneId: string;
    spaceType: SpaceType;
    tier: TeamStatus;
    amount: string;
    effectiveFrom: string;
  }) {
    setSaving(true);
    try {
      const cents = parseDollars(data.amount);
      if (cents <= 0) {
        toast("Rate must be greater than $0.", "warn");
        return;
      }
      const body =
        data.spaceType === "rink"
          ? { team_status: data.tier, rate_cents_per_15min: cents, effective_from: data.effectiveFrom }
          : { team_status: data.tier, rate_cents_per_slot: cents, effective_from: data.effectiveFrom };

      const res = await fetch(`/api/lanes/${data.laneId}/rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Failed to add rate.", "error");
        return;
      }
      toast("Rate added.", "success");
      // Refresh rate history
      const histRes = await fetch(`/api/lanes/${data.laneId}/rates`);
      const histJson = await histRes.json() as { data?: PricingRateDetail[] };
      setRateHistory(histJson.data ?? []);
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Time slot operations ─────────────────────────────────────────────────

  async function handleAddSlot(data: {
    spaceId: string;
    label: string;
    start_time: string;
    end_time: string;
    sort_order: number;
  }) {
    setSaving(true);
    try {
      const res = await fetch("/api/time-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.status === 404) {
        toast("Time slot API not yet available.", "warn");
        setModal({ type: "none" });
        return;
      }
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Failed to add time slot.", "error");
        return;
      }
      toast("Time slot added.", "success");
      setModal({ type: "none" });
      await refreshSpaces();
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
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
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 600 }}>
            Space &amp; Lane Builder
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={ghostBtnStyle}
              onClick={() => setModal({ type: "add_slot", spaceId: spaces[0]?.id ?? "" })}
            >
              + Add Time Slot
            </button>
            <button
              style={ghostBtnStyle}
              onClick={() =>
                setModal({
                  type: "add_lane",
                  spaceId: spaces[0]?.id ?? "",
                  spaceType: spaces[0]?.space_type ?? "block_scheduled",
                })
              }
            >
              + Add Lane
            </button>
            <button style={primaryBtnStyle} onClick={() => setModal({ type: "add_space" })}>
              + Add Space
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "22px 26px", flex: 1 }}>
          {spaces.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: 12 }}>No spaces yet.</div>
              <button style={primaryBtnStyle} onClick={() => setModal({ type: "add_space" })}>
                Add First Space
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {spaces.map((space) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  onEditSpace={() => setModal({ type: "edit_space", space })}
                  onArchiveSpace={() => handleArchiveSpace(space)}
                  onAddLane={() =>
                    setModal({
                      type: "add_lane",
                      spaceId: space.id,
                      spaceType: space.space_type,
                    })
                  }
                  onAddSlot={() => setModal({ type: "add_slot", spaceId: space.id })}
                  onEditLane={(lane) =>
                    setModal({ type: "edit_lane", lane, spaceType: space.space_type })
                  }
                  onRateHistory={(lane) => openRateHistory(lane, space)}
                  onDeleteLane={(lane) =>
                    setModal({
                      type: "confirm_delete_lane",
                      laneId: lane.id,
                      laneName: lane.name,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal.type === "add_space" && (
        <SpaceModal
          onClose={() => setModal({ type: "none" })}
          onSave={handleSaveSpace}
          saving={saving}
        />
      )}
      {modal.type === "edit_space" && (
        <SpaceModal
          space={modal.space}
          onClose={() => setModal({ type: "none" })}
          onSave={handleSaveSpace}
          saving={saving}
        />
      )}
      {(modal.type === "add_lane" || modal.type === "edit_lane") && (
        <LaneModal
          spaceId={modal.type === "add_lane" ? modal.spaceId : (modal as { type: "edit_lane"; lane: LaneDetail; spaceType: SpaceType }).lane.space_id}
          spaceType={modal.spaceType}
          spaces={spaces}
          lane={modal.type === "edit_lane" ? modal.lane : undefined}
          onClose={() => setModal({ type: "none" })}
          onSave={handleSaveLane}
          saving={saving}
        />
      )}
      {modal.type === "rate_history" && (
        <RateHistoryModal
          lane={modal.lane}
          spaceName={modal.spaceName}
          spaceType={modal.spaceType}
          rates={rateHistory}
          loading={rateHistoryLoading}
          saving={saving}
          onClose={() => setModal({ type: "none" })}
          onAddRate={handleAddRate}
        />
      )}
      {modal.type === "add_slot" && (
        <SlotModal
          spaceId={modal.spaceId}
          spaces={spaces}
          onClose={() => setModal({ type: "none" })}
          onSave={handleAddSlot}
          saving={saving}
        />
      )}
      {modal.type === "confirm_delete_lane" && (
        <ConfirmDeleteModal
          title="Delete Lane"
          message={`Are you sure you want to delete lane "${modal.laneName}"? This cannot be undone.`}
          onClose={() => setModal({ type: "none" })}
          onConfirm={() => handleDeleteLane(modal.laneId)}
          saving={saving}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// SpaceCard
// ---------------------------------------------------------------------------

interface SpaceCardProps {
  space: SpaceDetail;
  onEditSpace: () => void;
  onArchiveSpace: () => void;
  onAddLane: () => void;
  onAddSlot: () => void;
  onEditLane: (lane: LaneDetail) => void;
  onRateHistory: (lane: LaneDetail) => void;
  onDeleteLane: (lane: LaneDetail) => void;
}

function SpaceCard({
  space,
  onEditSpace,
  onArchiveSpace,
  onAddLane,
  onAddSlot,
  onEditLane,
  onRateHistory,
  onDeleteLane,
}: SpaceCardProps) {
  const seasonLabel: Record<SeasonType, string> = {
    winter: "Winter",
    summer: "Summer",
    year_round: "Year-round",
  };

  const typeLabel: Record<SpaceType, string> = {
    block_scheduled: "Block-scheduled",
    rink: "Rink",
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {/* Space header */}
      <div
        style={{
          padding: "12px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600 }}>
            {space.name}
          </h3>
          <Badge label={typeLabel[space.space_type]} variant="blue" />
          <Badge label={seasonLabel[space.season]} variant="teal" />
          <Badge label={space.active ? "Active" : "Archived"} variant={space.active ? "green" : "gray"} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={ghostBtnStyle} onClick={onEditSpace}>
            Edit
          </button>
          <button style={ghostBtnStyle} onClick={onArchiveSpace}>
            {space.active ? "Archive" : "Restore"}
          </button>
          <button style={ghostBtnStyle} onClick={onAddLane}>
            + Lane
          </button>
          <button style={ghostBtnStyle} onClick={onAddSlot}>
            + Slot
          </button>
        </div>
      </div>

      {/* Two-column: Lanes + Time Slots */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {/* Lanes */}
        <div style={{ borderRight: "1px solid var(--border)" }}>
          <div
            style={{
              background: "var(--bg)",
              padding: "6px 14px",
              borderBottom: "1px solid var(--border)",
              fontSize: 10.5,
              fontWeight: 500,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Lanes
          </div>
          {space.lanes.length === 0 ? (
            <div
              style={{
                padding: "14px",
                fontSize: 13,
                color: "var(--text-hint)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>No lanes yet.</span>
              <button style={{ ...ghostBtnStyle, fontSize: 11 }} onClick={onAddLane}>
                + Add Lane
              </button>
            </div>
          ) : (
            space.lanes.map((lane) => (
              <div
                key={lane.id}
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{lane.name}</div>
                  {!lane.active && (
                    <Badge label="Inactive" variant="gray" />
                  )}
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button style={{ ...ghostBtnStyle, fontSize: 11 }} onClick={() => onEditLane(lane)}>
                    Edit
                  </button>
                  <button style={{ ...ghostBtnStyle, fontSize: 11 }} onClick={() => onRateHistory(lane)}>
                    Rates
                  </button>
                  <button style={{ ...dangerBtnStyle, fontSize: 11 }} onClick={() => onDeleteLane(lane)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Time Slots */}
        <div>
          <div
            style={{
              background: "var(--bg)",
              padding: "6px 14px",
              borderBottom: "1px solid var(--border)",
              fontSize: 10.5,
              fontWeight: 500,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Time Slots
          </div>
          {space.time_slots.length === 0 ? (
            <div
              style={{
                padding: "14px",
                fontSize: 13,
                color: "var(--text-hint)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>No slots yet.</span>
              <button style={{ ...ghostBtnStyle, fontSize: 11 }} onClick={onAddSlot}>
                + Add Slot
              </button>
            </div>
          ) : (
            space.time_slots.map((slot) => (
              <div
                key={slot.id}
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{slot.label}</div>
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: "'DM Mono', monospace",
                      color: "var(--text-muted)",
                    }}
                  >
                    {slot.start_time} – {slot.end_time}
                    {slot.sort_order !== undefined && (
                      <span style={{ marginLeft: 6, opacity: 0.6 }}>#{slot.sort_order}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpaceModal
// ---------------------------------------------------------------------------

interface SpaceModalProps {
  space?: SpaceDetail;
  onClose: () => void;
  onSave: (data: {
    name: string;
    space_type: SpaceType;
    season: SeasonType;
    active: boolean;
    notes: string;
    editId?: string;
  }) => void;
  saving: boolean;
}

function SpaceModal({ space, onClose, onSave, saving }: SpaceModalProps) {
  const [name, setName] = useState(space?.name ?? "");
  const [spaceType, setSpaceType] = useState<SpaceType>(space?.space_type ?? "block_scheduled");
  const [season, setSeason] = useState<SeasonType>(space?.season ?? "year_round");
  const [active, setActive] = useState(space?.active ?? true);
  const [notes, setNotes] = useState(space?.notes ?? "");

  return (
    <ModalWrapper onClose={onClose} title={space ? "Edit Space" : "Add Space"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Name</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Intermediate Hill"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Space Type</label>
            <select
              style={selectStyle}
              value={spaceType}
              onChange={(e) => setSpaceType(e.target.value as SpaceType)}
            >
              <option value="block_scheduled">Block-scheduled</option>
              <option value="rink">Rink</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Season</label>
            <select
              style={selectStyle}
              value={season}
              onChange={(e) => setSeason(e.target.value as SeasonType)}
            >
              <option value="winter">Winter</option>
              <option value="summer">Summer</option>
              <option value="year_round">Year-round</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            id="space-active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <label
            htmlFor="space-active"
            style={{ fontSize: 13, cursor: "pointer", color: "var(--text)" }}
          >
            Active
          </label>
        </div>
      </div>
      <ModalFooter
        onClose={onClose}
        onSave={() =>
          onSave({ name, space_type: spaceType, season, active, notes, editId: space?.id })
        }
        saving={saving}
      />
    </ModalWrapper>
  );
}

// ---------------------------------------------------------------------------
// LaneModal
// ---------------------------------------------------------------------------

interface LaneModalProps {
  spaceId: string;
  spaceType: SpaceType;
  spaces: SpaceDetail[];
  lane?: LaneDetail;
  onClose: () => void;
  onSave: (data: {
    spaceId: string;
    name: string;
    rates: Record<TeamStatus, string>;
    spaceType: SpaceType;
    editId?: string;
  }) => void;
  saving: boolean;
}

function LaneModal({ spaceId, spaceType, spaces, lane, onClose, onSave, saving }: LaneModalProps) {
  const [selectedSpaceId, setSelectedSpaceId] = useState(spaceId);
  const [name, setName] = useState(lane?.name ?? "");
  const [rates, setRates] = useState<Record<TeamStatus, string>>({
    residential: "",
    local: "",
    out_of_state: "",
    international: "",
  });

  const rateLabel = spaceType === "rink" ? "per 15 min" : "per slot";

  return (
    <ModalWrapper onClose={onClose} title={lane ? `Edit Lane — ${lane.name}` : "Add Lane"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Space</label>
          <select
            style={selectStyle}
            value={selectedSpaceId}
            onChange={(e) => setSelectedSpaceId(e.target.value)}
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Lane Name</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lane 1"
          />
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 8,
            }}
          >
            Rates ({rateLabel}, in $)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {TEAM_STATUS_TIERS.map((tier) => (
              <div key={tier}>
                <label style={labelStyle}>{TIER_LABELS[tier]}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                  value={rates[tier]}
                  onChange={(e) => setRates((prev) => ({ ...prev, [tier]: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-hint)", marginTop: 6 }}>
            Leave blank to skip rate setting. You can set rates via Rate History.
          </div>
        </div>
      </div>
      <ModalFooter
        onClose={onClose}
        onSave={() =>
          onSave({
            spaceId: selectedSpaceId,
            name,
            rates,
            spaceType,
            editId: lane?.id,
          })
        }
        saving={saving}
      />
    </ModalWrapper>
  );
}

// ---------------------------------------------------------------------------
// RateHistoryModal
// ---------------------------------------------------------------------------

interface RateHistoryModalProps {
  lane: LaneDetail;
  spaceName: string;
  spaceType: SpaceType;
  rates: PricingRateDetail[];
  loading: boolean;
  saving: boolean;
  onClose: () => void;
  onAddRate: (data: {
    laneId: string;
    spaceType: SpaceType;
    tier: TeamStatus;
    amount: string;
    effectiveFrom: string;
  }) => void;
}

function RateHistoryModal({
  lane,
  spaceName,
  spaceType,
  rates,
  loading,
  saving,
  onClose,
  onAddRate,
}: RateHistoryModalProps) {
  const [newTier, setNewTier] = useState<TeamStatus>("residential");
  const [newAmount, setNewAmount] = useState("");
  const [newEffectiveFrom, setNewEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));

  const thStyle: React.CSSProperties = {
    background: "var(--bg)",
    padding: "6px 10px",
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
    padding: "7px 10px",
    borderBottom: "1px solid var(--border)",
    fontSize: 12,
    color: "var(--text)",
  };

  const rateLabel = spaceType === "rink" ? "/15 min" : "/slot";

  return (
    <ModalWrapper onClose={onClose} title={`Rate History — ${lane.name}`} wide>
      <div style={{ marginBottom: 6, fontSize: 12, color: "var(--text-muted)" }}>
        {spaceName}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
          Loading…
        </div>
      ) : rates.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 13 }}>
          No rate history found.
        </div>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>Tier</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Rate{rateLabel}</th>
                <th style={thStyle}>Effective From</th>
                <th style={thStyle}>Effective To</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => {
                const rateCents = r.rate_cents_per_slot ?? r.rate_cents_per_15min ?? 0;
                return (
                  <tr key={r.id}>
                    <td style={tdStyle}>
                      <Badge
                        label={TIER_LABELS[r.team_status]}
                        variant={
                          r.team_status === "residential"
                            ? "blue"
                            : r.team_status === "local"
                            ? "teal"
                            : r.team_status === "out_of_state"
                            ? "gold"
                            : "purple"
                        }
                      />
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {formatDollars(rateCents)}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "'DM Mono', monospace" }}>
                      {r.effective_from}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "'DM Mono', monospace" }}>
                      {r.effective_to ?? (
                        <span style={{ color: "var(--green)", fontWeight: 500 }}>Current</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add new rate form */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 14,
          marginTop: 4,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 10,
          }}
        >
          Add New Rate
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Tier</label>
            <select
              style={selectStyle}
              value={newTier}
              onChange={(e) => setNewTier(e.target.value as TeamStatus)}
            >
              {TEAM_STATUS_TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Rate ($){rateLabel}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              style={inputStyle}
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={labelStyle}>Effective From</label>
            <input
              type="date"
              style={inputStyle}
              value={newEffectiveFrom}
              onChange={(e) => setNewEffectiveFrom(e.target.value)}
            />
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <button
            style={{ ...primaryBtnStyle, opacity: saving ? 0.7 : 1 }}
            disabled={saving}
            onClick={() =>
              onAddRate({
                laneId: lane.id,
                spaceType,
                tier: newTier,
                amount: newAmount,
                effectiveFrom: newEffectiveFrom,
              })
            }
          >
            {saving ? "Saving…" : "Add Rate"}
          </button>
        </div>
      </div>

      <ModalFooter onClose={onClose} onSave={onClose} saveLabel="Close" saving={false} />
    </ModalWrapper>
  );
}

// ---------------------------------------------------------------------------
// SlotModal
// ---------------------------------------------------------------------------

interface SlotModalProps {
  spaceId: string;
  spaces: SpaceDetail[];
  onClose: () => void;
  onSave: (data: {
    spaceId: string;
    label: string;
    start_time: string;
    end_time: string;
    sort_order: number;
  }) => void;
  saving: boolean;
}

function SlotModal({ spaceId, spaces, onClose, onSave, saving }: SlotModalProps) {
  const [selectedSpaceId, setSelectedSpaceId] = useState(spaceId);
  const [label, setLabel] = useState("");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("09:00");
  const [sortOrder, setSortOrder] = useState(0);

  return (
    <ModalWrapper onClose={onClose} title="Add Time Slot">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Space</label>
          <select
            style={selectStyle}
            value={selectedSpaceId}
            onChange={(e) => setSelectedSpaceId(e.target.value)}
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Label</label>
          <input
            style={inputStyle}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. 7am–9am"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Start Time</label>
            <input
              type="time"
              style={inputStyle}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>End Time</label>
            <input
              type="time"
              style={inputStyle}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Sort Order</label>
          <input
            type="number"
            style={inputStyle}
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </div>
      <ModalFooter
        onClose={onClose}
        onSave={() =>
          onSave({
            spaceId: selectedSpaceId,
            label,
            start_time: startTime,
            end_time: endTime,
            sort_order: sortOrder,
          })
        }
        saving={saving}
      />
    </ModalWrapper>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDeleteModal
// ---------------------------------------------------------------------------

function ConfirmDeleteModal({
  title,
  message,
  onClose,
  onConfirm,
  saving,
}: {
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  return (
    <ModalWrapper onClose={onClose} title={title}>
      <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 16 }}>{message}</p>
      <ModalFooter
        onClose={onClose}
        onSave={onConfirm}
        saveLabel={saving ? "Deleting…" : "Delete"}
        saveDanger
        saving={saving}
      />
    </ModalWrapper>
  );
}

// ---------------------------------------------------------------------------
// Shared modal primitives
// ---------------------------------------------------------------------------

function ModalWrapper({
  children,
  onClose,
  title,
  wide,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
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
          maxWidth: wide ? 680 : 460,
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
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
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 18,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ✕
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: 20, flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({
  onClose,
  onSave,
  saving,
  saveLabel = "Save",
  saveDanger,
}: {
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
  saveDanger?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        paddingTop: 16,
        borderTop: "1px solid var(--border)",
        marginTop: 16,
      }}
    >
      <button onClick={onClose} style={ghostBtnStyle}>
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          ...(saveDanger ? dangerBtnStyle : primaryBtnStyle),
          opacity: saving ? 0.7 : 1,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
