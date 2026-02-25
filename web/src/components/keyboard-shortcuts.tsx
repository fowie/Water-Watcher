"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Keyboard } from "lucide-react";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Open search palette" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Esc"], description: "Close dialogs and overlays" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Tab"], description: "Move focus to next element" },
      { keys: ["Shift", "Tab"], description: "Move focus to previous element" },
      { keys: ["Enter"], description: "Activate focused link or button" },
    ],
  },
  {
    title: "Search Palette",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Navigate results" },
      { keys: ["Enter"], description: "Select result" },
      { keys: ["Esc"], description: "Close search" },
    ],
  },
  {
    title: "Photo Gallery",
    shortcuts: [
      { keys: ["←", "→"], description: "Previous / next photo" },
      { keys: ["Esc"], description: "Close lightbox" },
    ],
  },
];

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  // Global ? shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onOpenChange(!open);
      }

      if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Content */}
      <div className="relative mx-auto mt-[10vh] w-full max-w-lg px-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1.5 hover:bg-[var(--secondary)] transition-colors"
              aria-label="Close keyboard shortcuts"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Shortcut groups */}
          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                  {group.title}
                </h3>
                <div className="space-y-1.5">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.description}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <span key={i}>
                            <kbd className="inline-flex items-center justify-center h-6 min-w-[1.5rem] px-1.5 rounded border border-[var(--border)] bg-[var(--muted)] text-[11px] font-mono font-medium text-[var(--muted-foreground)]">
                              {key}
                            </kbd>
                            {i < shortcut.keys.length - 1 && (
                              <span className="text-[var(--muted-foreground)] text-xs mx-0.5">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[var(--border)] text-center">
            <p className="text-xs text-[var(--muted-foreground)]">
              Press <kbd className="inline-flex items-center justify-center h-5 min-w-[1rem] px-1 rounded border border-[var(--border)] bg-[var(--muted)] text-[10px] font-mono font-medium mx-0.5">?</kbd> anytime to toggle this overlay
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
