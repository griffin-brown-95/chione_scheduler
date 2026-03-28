"use client";

import React, { useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import type {
  InvoiceSummary,
  TeamInvoice,
  InvoiceLineItem,
  TeamStatus,
} from "@/lib/api/types";

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
    case "residential":   return "blue";
    case "local":         return "teal";
    case "out_of_state":  return "gold";
    case "international": return "purple";
    default:              return "gray";
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
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(cents: number): string {
  return "$" + (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const thStyle: React.CSSProperties = {
  background: "var(--bg)",
  padding: "7px 11px",
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
  padding: "7px 11px",
  borderBottom: "1px solid var(--border)",
  fontSize: 12,
  color: "var(--text)",
  verticalAlign: "middle",
};

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--r)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  color: "var(--text)",
  background: "var(--surface)",
  outline: "none",
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

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

const ghostBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "7px 14px",
  borderRadius: "var(--r)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid var(--border-strong)",
  background: "transparent",
  color: "var(--text)",
  whiteSpace: "nowrap",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10.5,
  fontWeight: 500,
  color: "var(--text-muted)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: 4,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InvoicingClient() {
  const { toast } = useToast();
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<InvoiceSummary[] | null>(null);
  const [teamInvoices, setTeamInvoices] = useState<TeamInvoice[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Year options: current year and 3 years back/forward
  const years: number[] = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) {
    years.push(y);
  }

  // ── Generate invoice ──────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSummaries(null);
    setTeamInvoices([]);

    try {
      // 1. Fetch summaries
      const res = await fetch(`/api/invoices?month=${month}&year=${year}`);
      const json = await res.json() as { data?: InvoiceSummary[]; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to fetch invoice data.");
        return;
      }

      const summaryData = json.data ?? [];
      setSummaries(summaryData);

      // 2. Fetch per-team detail in parallel
      if (summaryData.length > 0) {
        setLoadingDetail(true);
        const detailPromises = summaryData.map((s) =>
          fetch(`/api/invoices/${s.team.id}?month=${month}&year=${year}`)
            .then((r) => r.json() as Promise<{ data?: TeamInvoice; error?: string }>)
            .then((j) => j.data ?? null)
        );
        const details = await Promise.all(detailPromises);
        setTeamInvoices(details.filter((d): d is TeamInvoice => d !== null));
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      setLoadingDetail(false);
    }
  }, [month, year]);

  // ── CSV Export ────────────────────────────────────────────────────────────

  function handleExportCSV() {
    if (teamInvoices.length === 0) {
      toast("No data to export.", "warn");
      return;
    }

    const rows: string[] = [
      "Team,Status,Date,Space,Lane,Slot/Time,Group,Unit Rate,Qty,Subtotal,Discount,Total",
    ];

    for (const inv of teamInvoices) {
      for (const li of inv.line_items) {
        const slotOrTime =
          li.slot_label ??
          (li.start_time ? `${li.start_time}–${li.end_time}` : "");
        rows.push(
          [
            `"${inv.team.name}"`,
            inv.team.status,
            li.booking_date,
            `"${li.space_name}"`,
            `"${li.lane_name}"`,
            `"${slotOrTime}"`,
            `"${li.group_name ?? ""}"`,
            (li.unit_rate_cents / 100).toFixed(2),
            li.quantity,
            (li.subtotal_cents / 100).toFixed(2),
            (li.discount_amount_cents / 100).toFixed(2),
            (li.total_cents / 100).toFixed(2),
          ].join(",")
        );
      }
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${MONTH_NAMES[month - 1]}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV exported.", "success");
  }

  // ── Grand total ───────────────────────────────────────────────────────────

  const grandTotal = teamInvoices.reduce((s, inv) => s + inv.grand_total_cents, 0);

  // ── Render ────────────────────────────────────────────────────────────────
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
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 600 }}>
          Invoicing &amp; Reports
        </h2>
        {teamInvoices.length > 0 && (
          <button style={ghostBtnStyle} onClick={handleExportCSV}>
            Export CSV
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "22px 26px", flex: 1 }}>
        {/* Period picker */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "14px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "flex-end",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <label style={labelStyle}>Month</label>
            <select
              style={{ ...selectStyle, minWidth: 140 }}
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={i + 1} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Year</label>
            <select
              style={{ ...selectStyle, minWidth: 100 }}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            style={{ ...primaryBtnStyle, opacity: loading ? 0.7 : 1 }}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? "Loading…" : "Generate"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "var(--red-bg)",
              color: "var(--red)",
              border: "1px solid var(--red-border)",
              borderRadius: "var(--r)",
              fontSize: 13,
              marginBottom: 16,
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
              gap: 10,
              padding: "60px 20px",
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
                animation: "invSpin .7s linear infinite",
              }}
            />
            <style>{`@keyframes invSpin { to { transform: rotate(360deg); } }`}</style>
            Generating report…
          </div>
        )}

        {/* Results */}
        {!loading && summaries !== null && (
          <>
            {summaries.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 20px",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                No active bookings found for {MONTH_NAMES[month - 1]} {year}.
              </div>
            ) : (
              <>
                {/* Summary card */}
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-lg)",
                    padding: "16px 20px",
                    marginBottom: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: 4,
                      }}
                    >
                      {MONTH_NAMES[month - 1]} {year} — Grand Total
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 28,
                        fontWeight: 500,
                        color: "var(--text)",
                      }}
                    >
                      {formatCurrency(grandTotal)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    {summaries
                      .filter((s) => s.booking_count > 0)
                      .map((s) => (
                        <div key={s.team.id} style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
                            {s.team.name}
                          </div>
                          <div
                            style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 14,
                              fontWeight: 500,
                            }}
                          >
                            {formatCurrency(s.grand_total_cents)}
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--text-hint)" }}>
                            {s.booking_count} bookings
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Per-team detail cards */}
                {loadingDetail && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px",
                      color: "var(--text-muted)",
                      fontSize: 13,
                    }}
                  >
                    Loading line items…
                  </div>
                )}

                {!loadingDetail &&
                  teamInvoices
                    .filter((inv) => inv.line_items.length > 0)
                    .map((inv) => (
                      <TeamInvoiceCard key={inv.team.id} invoice={inv} />
                    ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TeamInvoiceCard
// ---------------------------------------------------------------------------

function TeamInvoiceCard({ invoice }: { invoice: TeamInvoice }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      {/* Card header */}
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
            {invoice.team.name}
          </h3>
          <Badge
            label={invoice.team.status.replace(/_/g, " ")}
            variant={teamStatusVariant(invoice.team.status)}
          />
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {formatCurrency(invoice.grand_total_cents)}
        </div>
      </div>

      {/* Line items table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Space</th>
              <th style={thStyle}>Lane</th>
              <th style={thStyle}>Slot / Time</th>
              <th style={thStyle}>Group</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Unit Rate</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Qty</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Subtotal</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Discount</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.line_items.map((li) => (
              <LineItemRow key={li.booking_id} item={li} />
            ))}
            {/* Subtotal row */}
            <tr style={{ background: "var(--bg)" }}>
              <td
                colSpan={7}
                style={{
                  ...tdStyle,
                  textAlign: "right",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Subtotal
              </td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: "right",
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 600,
                }}
              >
                {formatCurrency(invoice.subtotal_cents)}
              </td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: "right",
                  fontFamily: "'DM Mono', monospace",
                  color: "var(--red)",
                }}
              >
                {invoice.discount_total_cents > 0
                  ? `−${formatCurrency(invoice.discount_total_cents)}`
                  : "—"}
              </td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: "right",
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {formatCurrency(invoice.grand_total_cents)}
              </td>
            </tr>
            {invoice.discount_percent > 0 && (
              <tr style={{ background: "var(--bg)" }}>
                <td
                  colSpan={10}
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontSize: 11,
                    color: "var(--text-hint)",
                  }}
                >
                  {invoice.discount_percent}% team discount applied
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineItemRow({ item }: { item: InvoiceLineItem }) {
  const slotOrTime =
    item.slot_label ?? (item.start_time ? `${item.start_time}–${item.end_time}` : "—");

  return (
    <tr
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLTableRowElement).style.background = "var(--surface2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
      }}
    >
      <td style={{ ...tdStyle, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
        {item.booking_date}
      </td>
      <td style={tdStyle}>{item.space_name}</td>
      <td style={tdStyle}>{item.lane_name}</td>
      <td style={tdStyle}>{slotOrTime}</td>
      <td style={{ ...tdStyle, color: "var(--text-muted)" }}>{item.group_name ?? "—"}</td>
      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'DM Mono', monospace" }}>
        {formatCurrency(item.unit_rate_cents)}
      </td>
      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'DM Mono', monospace" }}>
        {item.quantity}
      </td>
      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'DM Mono', monospace" }}>
        {formatCurrency(item.subtotal_cents)}
      </td>
      <td
        style={{
          ...tdStyle,
          textAlign: "right",
          fontFamily: "'DM Mono', monospace",
          color: item.discount_amount_cents > 0 ? "var(--red)" : "var(--text-hint)",
        }}
      >
        {item.discount_amount_cents > 0
          ? `−${formatCurrency(item.discount_amount_cents)}`
          : "—"}
      </td>
      <td
        style={{
          ...tdStyle,
          textAlign: "right",
          fontFamily: "'DM Mono', monospace",
          fontWeight: 500,
        }}
      >
        {formatCurrency(item.total_cents)}
      </td>
    </tr>
  );
}
