"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserRole = "admin" | "team";

interface SidebarProps {
  role: UserRole;
  userName: string;
  teamName: string | null;
}

// SVG icon helper
function Icon({ path, size = 15 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
};

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface NavSection {
  section: string;
}

type NavEntry = NavItem | NavSection;

const ADMIN_NAV: NavEntry[] = [
  { label: "Dashboard", href: "/dashboard", icon: ICONS.grid },
  { label: "Gantt Calendar", href: "/calendar", icon: ICONS.cal },
  { label: "All Bookings", href: "/bookings", icon: ICONS.list },
  { section: "Admin" },
  { label: "Space Builder", href: "/builder", icon: ICONS.map },
  { label: "Teams", href: "/teams", icon: ICONS.users },
  { label: "Groups", href: "/groups", icon: ICONS.tag },
  { section: "Reports" },
  { label: "Invoicing", href: "/invoicing", icon: ICONS.doc },
];

const TEAM_NAV: NavEntry[] = [
  { label: "Dashboard", href: "/dashboard", icon: ICONS.grid },
  { label: "Book a Lane", href: "/calendar", icon: ICONS.cal },
  { label: "My Bookings", href: "/my-bookings", icon: ICONS.list },
  { label: "My Groups", href: "/groups", icon: ICONS.tag },
];

export default function Sidebar({ role, userName, teamName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = role === "admin" ? ADMIN_NAV : TEAM_NAV;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav
      style={{
        width: 228,
        background: "#0E2438",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        overflowY: "auto",
      }}
    >
      {/* Logo section */}
      <div
        style={{
          padding: "18px 16px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", gap: 3, marginBottom: 9 }}>
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              border: "2.5px solid #4FC3F7",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              border: "2.5px solid #FFD54F",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              border: "2.5px solid #EF5350",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              border: "2.5px solid #66BB6A",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              border: "2.5px solid #EF5350",
              display: "inline-block",
              opacity: 0.5,
            }}
          />
        </div>
        <h1
          style={{
            fontFamily: "'Syne', sans-serif",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: "0.03em",
            lineHeight: 1.4,
          }}
        >
          Olympic Park
          <br />
          Lane Management
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.42)",
            fontSize: 11,
            marginTop: 2,
          }}
        >
          Park City · Utah
        </p>
      </div>

      {/* User info box */}
      <div
        style={{
          margin: "10px 14px",
          background: "rgba(255,255,255,0.08)",
          borderRadius: 7,
          padding: "8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Signed in as
        </span>
        <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>
          {userName}
        </span>
        {teamName && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            {teamName}
          </span>
        )}
      </div>

      {/* Nav */}
      <div style={{ padding: "6px 0", flex: 1 }}>
        {navItems.map((entry, i) => {
          if ("section" in entry) {
            return (
              <div
                key={`section-${i}`}
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.35)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "4px 16px",
                  marginTop: 6,
                }}
              >
                {entry.section}
              </div>
            );
          }

          const isActive = pathname === entry.href;
          return (
            <Link
              key={entry.href}
              href={entry.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 16px",
                background: isActive
                  ? "rgba(255,255,255,0.12)"
                  : "transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                textDecoration: "none",
                transition: "background 0.15s, color 0.15s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "rgba(255,255,255,0.6)";
                }
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.75, display: "flex" }}>
                <Icon path={entry.icon} />
              </span>
              {entry.label}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "auto",
          padding: "12px 14px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <button
          onClick={handleSignOut}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,255,255,0.5)",
            fontSize: 12,
            fontFamily: "'DM Sans', sans-serif",
            padding: "4px 0",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color =
              "rgba(255,255,255,0.85)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color =
              "rgba(255,255,255,0.5)";
          }}
        >
          <Icon path={ICONS.logout} size={13} />
          Sign out
        </button>
      </div>
    </nav>
  );
}
