import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/api/auth";
import { ToastProvider } from "@/components/Toast";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthContext();
  if (!ctx) {
    redirect("/login");
  }

  // Get the user's email
  const {
    data: { user },
  } = await ctx.supabase.auth.getUser();
  const userEmail = user?.email ?? "User";

  // Fetch team name if role is 'team' and team_id exists
  let teamName: string | null = null;
  if (ctx.profile.role === "team" && ctx.profile.team_id) {
    const { data } = await ctx.supabase
      .from("teams")
      .select("name")
      .eq("id", ctx.profile.team_id)
      .single();
    teamName = data?.name ?? null;
  }

  return (
    <ToastProvider>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar
          role={ctx.profile.role}
          userName={userEmail}
          teamName={teamName}
        />
        <div
          style={{
            marginLeft: 228,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: "100vh",
            minWidth: 0,
          }}
        >
          {children}
        </div>
      </div>
    </ToastProvider>
  );
}
