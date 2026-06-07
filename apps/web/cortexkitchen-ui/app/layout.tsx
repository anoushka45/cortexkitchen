import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { DashboardProvider } from "@/context/DashboardContext";
import NavBar from "@/components/layout/NavBar";

export const metadata: Metadata = {
  title: "CortexKitchen — Ops Intelligence",
  description: "Multi-agent restaurant operations planning platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <DashboardProvider>
            <NavBar />
            <main className="flex-1">{children}</main>
          </DashboardProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
