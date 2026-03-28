"use client";

import React, { useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import type { GroupDetail, TeamDetail, UserRole } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Badge helpers
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

// ---------------------------------------------------------------------------
// Styles
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

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

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

// ---------------------------------------------------------------------------
// Modal types
// ---------------------------------------------------------------------------

type ModalState =
  | { type: "none" }
  | { type: "add_group" }
  | { type: "edit_group"; group: GroupDetail }
  | { type: "confirm_delete"; group: GroupDetail };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GroupsClientProps {
  initialGroups: GroupDetail[];
  role: UserRole;
  myTeamId: string | null;
  teams: TeamDetail[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GroupsClient({
  initialGroups,
  role,
  myTeamId,
  teams,
}: GroupsClientProps) {
  const { toast } = useToast();
  const isAdmin = role === "admin";
  const [groups, setGroups] = useState<GroupDetail[]>(initialGroups);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [saving, setSaving] = useState(false);

  // Team filter (admin only)
  const [filterTeamId, setFilterTeamId] = useState("");

  const refreshGroups = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterTeamId) params.set("team_id", filterTeamId);
    const res = await fetch(`/api/groups?${params}`);
    const json = await res.json() as { data?: GroupDetail[] };
    if (json.data) setGroups(json.data);
  }, [filterTeamId]);

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async function handleSaveGroup(data: {
    name: string;
    teamId: string;
    active: boolean;
    notes: string;
    editId?: string;
  }) {
    setSaving(true);
    try {
      const url = data.editId ? `/api/groups/${data.editId}` : "/api/groups";
      const method = data.editId ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        name: data.name,
        active: data.active,
        notes: data.notes || null,
      };

      // Only include team_id on POST (or for admins)
      if (!data.editId) {
        body.team_id = data.teamId;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Failed to save group.", "error");
        return;
      }
      toast(data.editId ? "Group updated." : "Group created.", "success");
      setModal({ type: "none" });
      await refreshGroups();
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup(group: GroupDetail) {
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Failed to delete group.", "error");
        return;
      }
      toast("Group deleted.", "success");
      setModal({ type: "none" });
      await refreshGroups();
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  // Visible groups (with client-side team filter)
  const visibleGroups = filterTeamId
    ? groups.filter((g) => g.team_id === filterTeamId)
    : groups;

  const teamById = (id: string) => teams.find((t) => t.id === id);

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
            {isAdmin ? "Groups" : "My Groups"}
          </h2>
          <button style={primaryBtnStyle} onClick={() => setModal({ type: "add_group" })}>
            + Add Group
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "22px 26px", flex: 1 }}>
          {/* Team filter (admin only) */}
          {isAdmin && teams.length > 0 && (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: "12px 16px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                }}
              >
                Filter by Team
              </label>
              <select
                style={{ ...selectStyle, maxWidth: 240 }}
                value={filterTeamId}
                onChange={(e) => setFilterTeamId(e.target.value)}
              >
                <option value="">All Teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {filterTeamId && (
                <button
                  style={{ ...ghostBtnStyle, fontSize: 12 }}
                  onClick={() => setFilterTeamId("")}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Team context banner for non-admin */}
          {!isAdmin && (
            <div
              style={{
                padding: "8px 14px",
                background: "var(--navy-pale)",
                borderRadius: "var(--r)",
                fontSize: 12,
                color: "var(--navy)",
                marginBottom: 14,
              }}
            >
              Showing groups for your team
            </div>
          )}

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
            }}
          >
            {visibleGroups.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 20px",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                No groups found.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      {isAdmin && <th style={thStyle}>Team</th>}
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Notes</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleGroups.map((group) => {
                      const team = teamById(group.team_id);
                      return (
                        <tr
                          key={group.id}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.background =
                              "var(--surface2)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.background =
                              "transparent";
                          }}
                        >
                          <td style={{ ...tdStyle, fontWeight: 500 }}>{group.name}</td>
                          {isAdmin && (
                            <td style={tdStyle}>
                              {team ? team.name : <span style={{ color: "var(--text-hint)" }}>—</span>}
                            </td>
                          )}
                          <td style={tdStyle}>
                            <Badge
                              label={group.active ? "Active" : "Inactive"}
                              variant={group.active ? "green" : "gray"}
                            />
                          </td>
                          <td style={{ ...tdStyle, color: "var(--text-muted)", maxWidth: 200 }}>
                            <span
                              style={{
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {group.notes ?? "—"}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            <div
                              style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}
                            >
                              <button
                                style={ghostBtnStyle}
                                onClick={() => setModal({ type: "edit_group", group })}
                              >
                                Edit
                              </button>
                              <button
                                style={dangerBtnStyle}
                                onClick={() => setModal({ type: "confirm_delete", group })}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal.type === "add_group" && (
        <GroupModal
          isAdmin={isAdmin}
          myTeamId={myTeamId}
          teams={teams}
          onClose={() => setModal({ type: "none" })}
          onSave={handleSaveGroup}
          saving={saving}
        />
      )}
      {modal.type === "edit_group" && (
        <GroupModal
          isAdmin={isAdmin}
          myTeamId={myTeamId}
          teams={teams}
          group={modal.group}
          onClose={() => setModal({ type: "none" })}
          onSave={handleSaveGroup}
          saving={saving}
        />
      )}
      {modal.type === "confirm_delete" && (
        <ConfirmDeleteModal
          groupName={modal.group.name}
          onClose={() => setModal({ type: "none" })}
          onConfirm={() => handleDeleteGroup(modal.group)}
          saving={saving}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// GroupModal
// ---------------------------------------------------------------------------

interface GroupModalProps {
  group?: GroupDetail;
  isAdmin: boolean;
  myTeamId: string | null;
  teams: TeamDetail[];
  onClose: () => void;
  onSave: (data: {
    name: string;
    teamId: string;
    active: boolean;
    notes: string;
    editId?: string;
  }) => void;
  saving: boolean;
}

function GroupModal({ group, isAdmin, myTeamId, teams, onClose, onSave, saving }: GroupModalProps) {
  const [name, setName] = useState(group?.name ?? "");
  const [teamId, setTeamId] = useState(group?.team_id ?? myTeamId ?? teams[0]?.id ?? "");
  const [active, setActive] = useState(group?.active ?? true);
  const [notes, setNotes] = useState(group?.notes ?? "");

  return (
    <ModalWrapper onClose={onClose} title={group ? "Edit Group" : "Add Group"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {isAdmin && !group && (
          <div>
            <label style={labelStyle}>Team</label>
            <select
              style={selectStyle}
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {isAdmin && group && (
          <div
            style={{
              padding: "7px 12px",
              background: "var(--navy-pale)",
              borderRadius: "var(--r)",
              fontSize: 12,
              color: "var(--navy)",
            }}
          >
            Team: <strong>{teams.find((t) => t.id === group.team_id)?.name ?? group.team_id}</strong>
          </div>
        )}
        <div>
          <label style={labelStyle}>Group Name</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. U14 Boys"
          />
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
            id="group-active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <label
            htmlFor="group-active"
            style={{ fontSize: 13, cursor: "pointer", color: "var(--text)" }}
          >
            Active
          </label>
        </div>
      </div>
      <ModalFooter
        onClose={onClose}
        onSave={() => onSave({ name, teamId, active, notes, editId: group?.id })}
        saving={saving}
      />
    </ModalWrapper>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDeleteModal
// ---------------------------------------------------------------------------

function ConfirmDeleteModal({
  groupName,
  onClose,
  onConfirm,
  saving,
}: {
  groupName: string;
  onClose: () => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  return (
    <ModalWrapper onClose={onClose} title="Delete Group">
      <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 16 }}>
        Are you sure you want to delete group &ldquo;{groupName}&rdquo;? This cannot be undone.
      </p>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
        }}
      >
        <button onClick={onClose} style={ghostBtnStyle}>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={saving}
          style={{
            ...ghostBtnStyle,
            border: "1px solid var(--red-border)",
            background: "var(--red-bg)",
            color: "var(--red)",
            opacity: saving ? 0.7 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Deleting…" : "Delete"}
        </button>
      </div>
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
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
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
          maxWidth: 460,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
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
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({
  onClose,
  onSave,
  saving,
  saveLabel = "Save",
}: {
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
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
          ...primaryBtnStyle,
          opacity: saving ? 0.7 : 1,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
