import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chione Scheduler",
  description: "Lane management and scheduling",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
