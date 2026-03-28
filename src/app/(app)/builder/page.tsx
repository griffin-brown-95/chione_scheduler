import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/api/auth";
import BuilderClient from "./BuilderClient";
import type { SpaceDetail } from "@/lib/api/types";

export default async function BuilderPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.profile.role !== "admin") redirect("/dashboard");

  // Fetch all spaces (including inactive) with lanes and time slots
  const { data: spacesRaw } = await ctx.supabase
    .from("spaces")
    .select(
      `
      id, name, space_type, season, active, notes,
      lanes(id, space_id, name, sort_order, active, notes),
      time_slots(id, label, start_time, end_time, sort_order, active)
    `
    )
    .order("name")
    .order("sort_order", { referencedTable: "lanes" })
    .order("sort_order", { referencedTable: "time_slots" });

  const spaces = (spacesRaw ?? []) as SpaceDetail[];

  return <BuilderClient initialSpaces={spaces} />;
}
