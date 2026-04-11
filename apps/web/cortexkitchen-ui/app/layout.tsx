import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CortexKitchen · Ops Intelligence",
  description: "Friday Night Rush multi-agent planning dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}