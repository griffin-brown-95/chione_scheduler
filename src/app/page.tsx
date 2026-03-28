import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/api/auth";

export default async function Home() {
  const ctx = await getAuthContext();
  if (ctx) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
