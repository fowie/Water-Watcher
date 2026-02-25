"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Waves,
  Mountain,
  ShoppingBag,
  Home,
  Menu,
  X,
  Settings,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenuDesktop, UserMenuMobile } from "@/components/user-menu";

const publicNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/rivers", label: "Rivers", icon: Mountain },
  { href: "/deals", label: "Raft Watch", icon: ShoppingBag },
];

const authNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navigation() {
  return (
    <>
      <DesktopNav />
      <MobileNav />
    </>
  );
}

function DesktopNav() {
  const pathname = usePathname();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const navItems = isAuthenticated ? [...publicNavItems, ...authNavItems] : publicNavItems;

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 border-r border-[var(--border)] bg-[var(--background)] z-30">
      {/* Brand */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-[var(--border)]">
        <Waves className="h-7 w-7 text-[var(--primary)]" />
        <span className="text-xl font-bold tracking-tight">
          Water-Watcher
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User menu + theme toggle */}
      <UserMenuDesktop />
      <div className="px-6 py-3 border-t border-[var(--border)] flex items-center justify-between">
        <p className="text-xs text-[var(--muted-foreground)]">
          🌊 Track rivers. Score gear.
        </p>
        <ThemeToggle />
      </div>
    </aside>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const navItems = isAuthenticated ? [...publicNavItems, ...authNavItems] : publicNavItems;
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm z-40 flex items-center px-4 justify-between">
        <div className="flex items-center gap-2">
          <Waves className="h-5 w-5 text-[var(--primary)]" />
          <span className="font-bold text-lg">Water-Watcher</span>
        </div>
        <div className="flex items-center gap-1">
          <UserMenuMobile />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSheetOpen(!sheetOpen)}
            aria-label={sheetOpen ? "Close menu" : "Open menu"}
            aria-expanded={sheetOpen}
          >
            {sheetOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </Button>
        </div>
      </header>

      {/* Mobile sheet overlay */}
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-[var(--background)] border-l border-[var(--border)] shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border)]">
              <span className="font-bold">Menu</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSheetOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
            <nav className="px-3 py-4 space-y-1" aria-label="Mobile navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm z-40 flex items-center justify-around px-2" aria-label="Bottom tab bar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 rounded-md text-xs transition-colors",
                active
                  ? "text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
