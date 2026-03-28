import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/api/auth";
import GroupsClient from "./GroupsClient";
import type { GroupDetail, TeamDetail } from "@/lib/api/types";

export default async function GroupsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const isAdmin = ctx.profile.role === "admin";

  // Fetch groups
  let groupsQuery = ctx.supabase
    .from("groups")
    .select("id, team_id, name, active, notes, created_at, updated_at")
    .order("name");

  if (!isAdmin && ctx.profile.team_id) {
    groupsQuery = groupsQuery.eq("team_id", ctx.profile.team_id);
  }

  const { data: groupsRaw } = await groupsQuery;
  const groups = (groupsRaw ?? []) as GroupDetail[];

  // Admin: also fetch teams for the team selector
  let teams: TeamDetail[] = [];
  if (isAdmin) {
    const { data: teamsRaw } = await ctx.supabase
      .from("teams")
      .select("id, name, status, active, notes, created_at")
      .eq("active", true)
      .order("name");
    teams = (teamsRaw ?? []) as TeamDetail[];
  }

  return (
    <GroupsClient
      initialGroups={groups}
      role={ctx.profile.role}
      myTeamId={ctx.profile.team_id}
      teams={teams}
    />
  );
}
