import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Toaster } from "@/components/toaster";
import { SessionProvider } from "@/components/session-provider";
import { NetworkStatus } from "@/components/network-status";
import { InstallPrompt } from "@/components/install-prompt";

export const metadata: Metadata = {
  title: {
    default: "Water-Watcher — Whitewater Rafting Tracker",
    template: "%s | Water-Watcher",
  },
  description:
    "Track whitewater rafting conditions, hazards, and gear deals across rivers.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏞️</text></svg>",
  },
  openGraph: {
    title: "Water-Watcher — Whitewater Rafting Tracker",
    description:
      "Monitor river conditions, active hazards, rapids, and find gear deals for your next whitewater adventure.",
    siteName: "Water-Watcher",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Water-Watcher — Whitewater Rafting Tracker",
    description:
      "Monitor river conditions, active hazards, rapids, and find gear deals for your next whitewater adventure.",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0ea5e9" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="min-h-screen antialiased">
        <SessionProvider>
          {/* Skip to content link for keyboard/screen-reader users */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--primary)] focus:text-[var(--primary-foreground)] focus:rounded-md focus:text-sm focus:font-medium focus:outline-2 focus:outline-offset-2 focus:outline-[var(--ring)] focus:shadow-lg"
          >
            Skip to content
          </a>
          <NetworkStatus />
          <Navigation />
          {/* Desktop: offset by sidebar width. Mobile: offset by header/bottom nav */}
          <div id="main-content" className="md:pl-64 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen" role="main">
            {children}
          </div>
          <Toaster />
          <InstallPrompt />
        </SessionProvider>
      </body>
    </html>
  );
}
