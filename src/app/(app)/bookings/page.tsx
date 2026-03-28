import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/api/auth";
import BookingsClient from "./BookingsClient";

export default async function BookingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.profile.role !== "admin") redirect("/dashboard");

  // Fetch spaces + teams for filter dropdowns
  const [spacesRes, teamsRes] = await Promise.all([
    ctx.supabase
      .from("spaces")
      .select("id, name")
      .eq("active", true)
      .order("name"),
    ctx.supabase
      .from("teams")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  const spaces = (spacesRes.data ?? []) as { id: string; name: string }[];
  const teams = (teamsRes.data ?? []) as { id: string; name: string }[];

  return <BookingsClient spaces={spaces} teams={teams} />;
}
