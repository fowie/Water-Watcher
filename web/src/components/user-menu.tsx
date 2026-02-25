"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { LogIn, LogOut, Settings, User, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Desktop sidebar user menu — bottom of sidebar. */
export function UserMenuDesktop() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  if (status === "loading") {
    return (
      <div className="px-6 py-4 border-t border-[var(--border)]">
        <div className="h-10 w-full rounded-md bg-[var(--muted)] animate-pulse" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="px-4 py-4 border-t border-[var(--border)]">
        <Button variant="outline" className="w-full" asChild>
          <Link href="/auth/signin">
            <LogIn className="h-4 w-4 mr-2" aria-hidden="true" />
            Sign In
          </Link>
        </Button>
      </div>
    );
  }

  const user = session.user;

  return (
    <div ref={menuRef} className="relative px-3 py-3 border-t border-[var(--border)]">
      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg z-50">
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <p className="text-sm font-medium truncate">{user.name || "User"}</p>
            <p className="text-xs text-[var(--muted-foreground)] truncate">{user.email}</p>
          </div>
          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--secondary)] transition-colors"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              Profile
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--secondary)] transition-colors"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Settings
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/auth/signin" });
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left hover:bg-[var(--secondary)] transition-colors text-[var(--destructive)]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="User menu"
        className={cn(
          "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--secondary)]",
          open && "bg-[var(--secondary)]"
        )}
      >
        <div className="h-8 w-8 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center text-xs font-bold shrink-0">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            getInitials(user.name)
          )}
        </div>
        <span className="flex-1 text-left truncate font-medium">{user.name || "User"}</span>
        <ChevronUp className={cn("h-4 w-4 text-[var(--muted-foreground)] transition-transform", open ? "rotate-0" : "rotate-180")} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Mobile top header user button. */
export function UserMenuMobile() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-8 w-8 rounded-full bg-[var(--muted)] animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link href="/auth/signin" aria-label="Sign in">
          <LogIn className="h-4 w-4 mr-1" aria-hidden="true" />
          <span className="text-xs">Sign In</span>
        </Link>
      </Button>
    );
  }

  const user = session.user;

  return (
    <Link
      href="/profile"
      className="flex items-center gap-1.5"
      title={user.name || "Account"}
      aria-label={`Profile: ${user.name || "Account"}`}
    >
      <div className="h-7 w-7 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center text-[10px] font-bold">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          getInitials(user.name)
        )}
      </div>
    </Link>
  );
}
