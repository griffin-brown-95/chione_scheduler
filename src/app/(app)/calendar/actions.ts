"use server";

import { getAuthContext } from "@/lib/api/auth";
import { buildSchedule } from "@/app/api/_lib/schedule";
import type { ScheduleData } from "@/lib/api/types";

export async function fetchWeekSchedule(
  dates: string[]
): Promise<(ScheduleData | null)[]> {
  const ctx = await getAuthContext();
  if (!ctx) return dates.map(() => null);
  const results = await Promise.all(
    dates.map((date) => buildSchedule(ctx.supabase, date))
  );
  return results.map((r) => r.data);
}

export async function fetchGroupsForTeam(
  teamId: string
): Promise<{ id: string; team_id: string; name: string }[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const { data } = await ctx.supabase
    .from("groups")
    .select("id, team_id, name")
    .eq("team_id", teamId)
    .eq("active", true)
    .order("name");
  return (data ?? []) as { id: string; team_id: string; name: string }[];
}
