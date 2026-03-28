import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/api/auth";
import InvoicingClient from "./InvoicingClient";

export default async function InvoicingPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.profile.role !== "admin") redirect("/dashboard");

  return <InvoicingClient />;
}
