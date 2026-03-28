"use client";

import React, { useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import type { TeamDetail, TeamStatus, UserRole } from "@/lib/api/types";

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

function teamStatusVariant(status: TeamStatus): BadgeVariant {
  switch (status) {
    case "residential":  return "blue";
    case "local":        return "teal";
    case "out_of_state": return "gold";
    case "international": return "purple";
    default:             return "gray";
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

// ---------------------------------------------------------------------------
// Modal types
// ---------------------------------------------------------------------------

type ModalState =
  | { type: "none" }
  | { type: "add_team" }
  | { type: "edit_team"; team: TeamDetail }
  | { type: "invite"; team: TeamDetail };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TeamsClientProps {
  initialTeams: TeamDetail[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamsClient({ initialTeams }: TeamsClientProps) {
  const { toast } = useToast();
  const [teams, setTeams] = useState<TeamDetail[]>(initialTeams);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [saving, setSaving] = useState(false);

  const refreshTeams = useCallback(async () => {
    const res = await fetch("/api/teams");
    const json = await res.json() as { data?: TeamDetail[] };
    if (json.data) setTeams(json.data);
  }, []);

  // ── Team CRUD ────────────────────────────────────────────────────────────

  async function handleSaveTeam(data: {
    name: string;
    status: TeamStatus;
    active: boolean;
    notes: string;
    editId?: string;
  }) {
    setSaving(true);
    try {
      const url = data.editId ? `/api/teams/${data.editId}` : "/api/teams";
      const method = data.editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          status: data.status,
          active: data.active,
          notes: data.notes || null,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Failed to save team.", "error");
        return;
      }
      toast(data.editId ? "Team updated." : "Team created.", "success");
      setModal({ type: "none" });
      await refreshTeams();
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(team: TeamDetail) {
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !team.active }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Failed to update team.", "error");
        return;
      }
      toast(team.active ? "Team deactivated." : "Team reactivated.", "success");
      await refreshTeams();
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleInvite(data: {
    email: string;
    role: UserRole;
    teamId: string;
  }) {
    setSaving(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, role: data.role, team_id: data.teamId }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast(json.error ?? "Failed to send invite.", "error");
        return;
      }
      toast(`Invite sent to ${data.email}`, "success");
      setModal({ type: "none" });
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
            Teams
          </h2>
          <button style={primaryBtnStyle} onClick={() => setModal({ type: "add_team" })}>
            + Add Team
          </button>
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
            {teams.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 20px",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                No teams yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Notes</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team) => (
                      <tr
                        key={team.id}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background =
                            "var(--surface2)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                        }}
                      >
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{team.name}</td>
                        <td style={tdStyle}>
                          <Badge
                            label={team.status.replace(/_/g, " ")}
                            variant={teamStatusVariant(team.status)}
                          />
                        </td>
                        <td style={tdStyle}>
                          <Badge
                            label={team.active ? "Active" : "Inactive"}
                            variant={team.active ? "green" : "gray"}
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
                            {team.notes ?? "—"}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              justifyContent: "flex-end",
                              flexWrap: "nowrap",
                            }}
                          >
                            <button
                              style={ghostBtnStyle}
                              onClick={() => setModal({ type: "edit_team", team })}
                            >
                              Edit
                            </button>
                            <button
                              style={ghostBtnStyle}
                              onClick={() => setModal({ type: "invite", team })}
                            >
                              Invite
                            </button>
                            <button
                              style={{
                                ...ghostBtnStyle,
                                color: team.active ? "var(--red)" : "var(--green)",
                                borderColor: team.active
                                  ? "var(--red-border)"
                                  : "var(--green-border)",
                              }}
                              onClick={() => handleToggleActive(team)}
                              disabled={saving}
                            >
                              {team.active ? "Deactivate" : "Reactivate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal.type === "add_team" && (
        <TeamModal
          onClose={() => setModal({ type: "none" })}
          onSave={handleSaveTeam}
          saving={saving}
        />
      )}
      {modal.type === "edit_team" && (
        <TeamModal
          team={modal.team}
          onClose={() => setModal({ type: "none" })}
          onSave={handleSaveTeam}
          saving={saving}
        />
      )}
      {modal.type === "invite" && (
        <InviteModal
          team={modal.team}
          onClose={() => setModal({ type: "none" })}
          onInvite={handleInvite}
          saving={saving}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// TeamModal
// ---------------------------------------------------------------------------

interface TeamModalProps {
  team?: TeamDetail;
  onClose: () => void;
  onSave: (data: {
    name: string;
    status: TeamStatus;
    active: boolean;
    notes: string;
    editId?: string;
  }) => void;
  saving: boolean;
}

function TeamModal({ team, onClose, onSave, saving }: TeamModalProps) {
  const [name, setName] = useState(team?.name ?? "");
  const [status, setStatus] = useState<TeamStatus>(team?.status ?? "local");
  const [active, setActive] = useState(team?.active ?? true);
  const [notes, setNotes] = useState(team?.notes ?? "");

  return (
    <ModalWrapper onClose={onClose} title={team ? "Edit Team" : "Add Team"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Team Name</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team name"
          />
        </div>
        <div>
          <label style={labelStyle}>Status Tier</label>
          <select
            style={selectStyle}
            value={status}
            onChange={(e) => setStatus(e.target.value as TeamStatus)}
          >
            <option value="residential">Residential</option>
            <option value="local">Local</option>
            <option value="out_of_state">Out-of-State</option>
            <option value="international">International</option>
          </select>
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
            id="team-active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <label
            htmlFor="team-active"
            style={{ fontSize: 13, cursor: "pointer", color: "var(--text)" }}
          >
            Active
          </label>
        </div>
      </div>
      <ModalFooter
        onClose={onClose}
        onSave={() => onSave({ name, status, active, notes, editId: team?.id })}
        saving={saving}
      />
    </ModalWrapper>
  );
}

// ---------------------------------------------------------------------------
// InviteModal
// ---------------------------------------------------------------------------

interface InviteModalProps {
  team: TeamDetail;
  onClose: () => void;
  onInvite: (data: { email: string; role: UserRole; teamId: string }) => void;
  saving: boolean;
}

function InviteModal({ team, onClose, onInvite, saving }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("team");

  return (
    <ModalWrapper onClose={onClose} title={`Invite to ${team.name}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            padding: "8px 12px",
            background: "var(--navy-pale)",
            borderRadius: "var(--r)",
            fontSize: 12,
            color: "var(--navy)",
          }}
        >
          Team: <strong>{team.name}</strong>
        </div>
        <div>
          <label style={labelStyle}>Email Address</label>
          <input
            type="email"
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label style={labelStyle}>Role</label>
          <select
            style={selectStyle}
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="team">Team</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <ModalFooter
        onClose={onClose}
        onSave={() => onInvite({ email, role, teamId: team.id })}
        saving={saving}
        saveLabel={saving ? "Sending…" : "Send Invite"}
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
