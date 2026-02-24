import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/navigation";

export const metadata: Metadata = {
  title: "Water-Watcher — Whitewater Rafting Tracker",
  description:
    "Track whitewater rafting conditions, hazards, and gear deals across rivers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Navigation />
        {/* Desktop: offset by sidebar width. Mobile: offset by header/bottom nav */}
        <div className="md:pl-64 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
