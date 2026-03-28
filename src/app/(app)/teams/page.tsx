import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/api/auth";
import TeamsClient from "./TeamsClient";
import type { TeamDetail } from "@/lib/api/types";

export default async function TeamsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.profile.role !== "admin") redirect("/dashboard");

  const { data: teamsRaw } = await ctx.supabase
    .from("teams")
    .select("id, name, status, active, notes, created_at")
    .order("name");

  const teams = (teamsRaw ?? []) as TeamDetail[];

  return <TeamsClient initialTeams={teams} />;
}
