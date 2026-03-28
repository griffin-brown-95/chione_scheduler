import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/api/auth";
import { buildSchedule } from "@/app/api/_lib/schedule";
import CalendarClient from "./CalendarClient";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

export type SpaceWithDetails = {
  id: string;
  name: string;
  space_type: string;
  season: string;
  active: boolean;
  lanes: Array<{
    id: string;
    space_id: string;
    name: string;
    sort_order: number;
    active: boolean;
  }>;
  time_slots: Array<{
    id: string;
    label: string;
    start_time: string;
    end_time: string;
    sort_order: number;
    active: boolean;
  }>;
};

export type TeamOption = {
  id: string;
  name: string;
  status: string;
  active: boolean;
};

export type GroupOption = {
  id: string;
  team_id: string;
  name: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CalendarPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const isAdmin = ctx.profile.role === "admin";

  // Compute current week's Mon–Sun
  const monday = getWeekMonday(new Date());
  const initialWeekDates: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toIso(d);
  });

  // Parallel fetches
  const [spacesResult, ...scheduleResults] = await Promise.all([
    ctx.supabase
      .from("spaces")
      .select(
        "id, name, space_type, season, active, lanes(id, space_id, name, sort_order, active), time_slots(id, label, start_time, end_time, sort_order, active)"
      )
      .eq("active", true)
      .order("name")
      .order("sort_order", { referencedTable: "lanes" })
      .order("sort_order", { referencedTable: "time_slots" }),
    ...initialWeekDates.map((date) => buildSchedule(ctx.supabase, date)),
  ]);

  const spaces = (spacesResult.data ?? []) as unknown as SpaceWithDetails[];

  const initialSchedule = (
    scheduleResults as Awaited<ReturnType<typeof buildSchedule>>[]
  ).map((r) => r.data);

  // Teams (admin only)
  let teams: TeamOption[] = [];
  if (isAdmin) {
    const { data } = await ctx.supabase
      .from("teams")
      .select("id, name, status, active")
      .eq("active", true)
      .order("name");
    teams = (data ?? []) as TeamOption[];
  }

  // Groups (team users only)
  let myGroups: GroupOption[] = [];
  if (!isAdmin && ctx.profile.team_id) {
    const { data } = await ctx.supabase
      .from("groups")
      .select("id, team_id, name")
      .eq("team_id", ctx.profile.team_id)
      .order("name");
    myGroups = (data ?? []) as GroupOption[];
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <CalendarClient
        initialWeekDates={initialWeekDates}
        initialSchedule={initialSchedule}
        spaces={spaces}
        teams={teams}
        myTeamId={ctx.profile.team_id}
        myGroups={myGroups}
        role={ctx.profile.role}
      />
    </div>
  );
}
