import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { DashboardProvider } from "@/context/DashboardContext";
import NavBar from "@/components/layout/NavBar";

export const metadata: Metadata = {
  title: "CortexKitchen · Ops Intelligence",
  description: "Multi-agent restaurant operations planning platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <AuthProvider>
          <DashboardProvider>
            <NavBar />
            {children}
          </DashboardProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
