import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { DashboardProvider } from "@/context/DashboardContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ChatSessionProvider } from "@/context/ChatSessionContext";
import NavBar from "@/components/layout/NavBar";
import FloatingChatWidget from "@/components/chat/FloatingChatWidget";

export const metadata: Metadata = {
  title: "CortexKitchen — Ops Intelligence",
  description: "Multi-agent restaurant operations planning platform",
};

// Runs before React hydrates so the correct theme class is on <html> for the
// very first paint -- without this, the page would flash the wrong theme
// every load while ThemeProvider's effect catches up.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("cortexkitchen-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

// suppressHydrationWarning below: THEME_INIT_SCRIPT intentionally mutates
// <html>'s class before React hydrates, so server and client legitimately
// disagree on className for one frame -- the standard, safe pattern for
// avoiding a theme flash.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <AuthProvider>
            <DashboardProvider>
              <ChatSessionProvider>
                <NavBar />
                <main className="flex-1">{children}</main>
                <FloatingChatWidget />
              </ChatSessionProvider>
            </DashboardProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
