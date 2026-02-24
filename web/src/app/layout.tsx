import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Toaster } from "@/components/toaster";

export const metadata: Metadata = {
  title: {
    default: "Water-Watcher — Whitewater Rafting Tracker",
    template: "%s | Water-Watcher",
  },
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
        {/* Skip to content link for keyboard/screen-reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--primary)] focus:text-[var(--primary-foreground)] focus:rounded-md focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        <Navigation />
        {/* Desktop: offset by sidebar width. Mobile: offset by header/bottom nav */}
        <div id="main-content" className="md:pl-64 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen" role="main">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
