import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import NavBar from "@/components/layout/NavBar";

export const metadata: Metadata = {
  title: "CortexKitchen · Ops Intelligence",
  description: "Friday Night Rush multi-agent planning dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <AuthProvider>
          <NavBar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
