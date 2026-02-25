/**
 * Accessibility tests for the Water-Watcher web application.
 *
 * Tests verify accessibility compliance at the source level:
 * - Skip-to-content link in root layout
 * - Main content landmark with role="main"
 * - Keyboard shortcuts helper responding to "?" key
 * - Keyboard shortcuts dialog ARIA attributes
 * - ARIA labels on key interactive elements across components
 * - Semantic navigation landmarks
 *
 * Approach: Source-level verification (no jsdom/browser required).
 * Uses fs.readFileSync to inspect component source for a11y patterns.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = path.join(process.cwd(), "src");
const readSrc = (file: string) => fs.readFileSync(path.join(SRC, file), "utf-8");

// ═══════════════════════════════════════════════════════
//  Skip-to-content link
// ═══════════════════════════════════════════════════════

describe("Skip-to-content link", () => {
  const layoutSrc = readSrc("app/layout.tsx");

  it("layout has a skip-to-content anchor element", () => {
    expect(layoutSrc).toContain("Skip to content");
  });

  it("skip link targets #main-content", () => {
    expect(layoutSrc).toContain('href="#main-content"');
  });

  it("skip link is visually hidden by default (sr-only)", () => {
    expect(layoutSrc).toContain("sr-only");
  });

  it("skip link becomes visible on focus (focus:not-sr-only)", () => {
    expect(layoutSrc).toContain("focus:not-sr-only");
  });

  it("main content div has id matching the skip link target", () => {
    expect(layoutSrc).toContain('id="main-content"');
  });

  it("main content div has role='main' landmark", () => {
    expect(layoutSrc).toContain('role="main"');
  });

  it("html element has lang attribute", () => {
    expect(layoutSrc).toContain('lang="en"');
  });
});

// ═══════════════════════════════════════════════════════
//  Keyboard shortcuts helper ("?" key)
// ═══════════════════════════════════════════════════════

describe("Keyboard shortcuts helper", () => {
  const kbSrc = readSrc("components/keyboard-shortcuts.tsx");

  it("listens for '?' key to toggle shortcuts overlay", () => {
    expect(kbSrc).toContain('e.key === "?"');
  });

  it("does not trigger when typing in input fields", () => {
    expect(kbSrc).toContain('"INPUT"');
    expect(kbSrc).toContain('"TEXTAREA"');
    expect(kbSrc).toContain('"SELECT"');
    expect(kbSrc).toContain("isContentEditable");
  });

  it("supports Escape key to close the dialog", () => {
    expect(kbSrc).toContain('"Escape"');
  });

  it("renders dialog with role='dialog'", () => {
    expect(kbSrc).toContain('role="dialog"');
  });

  it("renders dialog with aria-modal='true'", () => {
    expect(kbSrc).toContain('aria-modal="true"');
  });

  it("renders dialog with aria-label for screen readers", () => {
    expect(kbSrc).toContain('aria-label="Keyboard shortcuts"');
  });

  it("includes close button with aria-label", () => {
    expect(kbSrc).toContain('aria-label="Close keyboard shortcuts"');
  });

  it("decorative icons have aria-hidden='true'", () => {
    expect(kbSrc).toContain('aria-hidden="true"');
  });

  it("includes Global shortcuts section with Cmd+K", () => {
    expect(kbSrc).toContain("Open search palette");
  });

  it("includes Navigation shortcuts section", () => {
    expect(kbSrc).toContain("Move focus to next element");
  });

  it("includes Photo Gallery shortcuts section", () => {
    expect(kbSrc).toContain("Previous / next photo");
  });

  it("footer tells users to press ? to toggle", () => {
    expect(kbSrc).toContain("Press");
    expect(kbSrc).toContain("anytime to toggle");
  });
});

// ═══════════════════════════════════════════════════════
//  ARIA attributes on key interactive elements
// ═══════════════════════════════════════════════════════

describe("Navigation ARIA attributes", () => {
  const navSrc = readSrc("components/navigation.tsx");

  it("desktop nav has aria-label='Main navigation'", () => {
    expect(navSrc).toContain('aria-label="Main navigation"');
  });

  it("mobile nav has aria-label='Mobile navigation'", () => {
    expect(navSrc).toContain('aria-label="Mobile navigation"');
  });

  it("bottom tab bar has aria-label='Bottom tab bar'", () => {
    expect(navSrc).toContain('aria-label="Bottom tab bar"');
  });

  it("search button has aria-label", () => {
    expect(navSrc).toContain('aria-label="Search"');
  });

  it("menu toggle has aria-label and aria-expanded", () => {
    // Navigation uses JSX expression: aria-label={sheetOpen ? "Close menu" : "Open menu"}
    expect(navSrc).toContain('"Open menu"');
    expect(navSrc).toContain('"Close menu"');
    expect(navSrc).toContain("aria-expanded");
  });

  it("decorative icons have aria-hidden", () => {
    expect(navSrc).toContain('aria-hidden="true"');
  });
});

describe("Interactive component ARIA attributes", () => {
  it("river card has aria-labels for track/untrack and delete buttons", () => {
    const src = readSrc("components/river-card.tsx");
    expect(src).toContain("aria-label=");
    expect(src).toContain("Track");
    expect(src).toContain("Delete");
  });

  it("deal card has aria-label for view button", () => {
    const src = readSrc("components/deal-card.tsx");
    expect(src).toContain("aria-label=");
    expect(src).toContain("View deal");
  });

  it("notification bell has aria-label with dynamic alert count", () => {
    const src = readSrc("components/notification-bell.tsx");
    expect(src).toContain("aria-label=");
    expect(src).toContain("Notifications");
  });

  it("flow trend has aria-label describing trend direction", () => {
    const src = readSrc("components/flow-trend.tsx");
    expect(src).toContain("aria-label=");
    expect(src).toContain("Flow rate");
  });

  it("theme toggle has aria-label for current state", () => {
    const src = readSrc("components/theme-toggle.tsx");
    expect(src).toContain("aria-label=");
    expect(src).toContain("Switch to");
  });

  it("photo gallery lightbox has aria-labels for navigation", () => {
    const src = readSrc("components/photo-gallery.tsx");
    expect(src).toContain('aria-label="Close lightbox"');
    expect(src).toContain('aria-label="Previous photo"');
    expect(src).toContain('aria-label="Next photo"');
  });

  it("photo upload has aria-label for remove button", () => {
    const src = readSrc("components/photo-upload.tsx");
    expect(src).toContain('aria-label="Remove photo"');
  });

  it("star rating has role='img' with aria-label", () => {
    const src = readSrc("components/river-reviews.tsx");
    expect(src).toContain('role="img"');
    expect(src).toContain("out of 5 stars");
  });

  it("review form star buttons have aria-labels", () => {
    const src = readSrc("components/review-form.tsx");
    expect(src).toContain("aria-label=");
    expect(src).toContain("star");
  });

  it("notification toggle has role='group' with aria-label", () => {
    const src = readSrc("components/notification-toggle.tsx");
    expect(src).toContain('role="group"');
    expect(src).toContain('aria-label="Notification settings"');
  });

  it("map link has aria-label for external link", () => {
    const src = readSrc("components/map-link.tsx");
    expect(src).toContain("aria-label=");
    expect(src).toContain("Google Maps");
  });

  it("search palette input has aria-label", () => {
    const src = readSrc("components/search-palette.tsx");
    expect(src).toContain('aria-label="Search"');
    expect(src).toContain('aria-label="Clear search"');
  });

  it("edit river dialog has aria-label on button", () => {
    const src = readSrc("components/edit-river-dialog.tsx");
    expect(src).toContain('aria-label="Edit river details"');
  });

  it("river card uses keyboard-accessible handler with Enter/Space", () => {
    const src = readSrc("components/river-card.tsx");
    expect(src).toContain('role="button"');
    expect(src).toContain("tabIndex={0}");
    expect(src).toContain('"Enter"');
    expect(src).toContain('" "');
  });
});

// ═══════════════════════════════════════════════════════
//  Search palette keyboard shortcuts
// ═══════════════════════════════════════════════════════

describe("Search palette keyboard shortcuts", () => {
  const searchSrc = readSrc("components/search-palette.tsx");

  it("registers Cmd/Ctrl+K global keyboard shortcut", () => {
    expect(searchSrc).toContain("e.metaKey || e.ctrlKey");
    expect(searchSrc).toContain('e.key === "k"');
  });

  it("supports Arrow key navigation in results", () => {
    expect(searchSrc).toContain('"ArrowDown"');
    expect(searchSrc).toContain('"ArrowUp"');
  });

  it("supports Enter to select result", () => {
    expect(searchSrc).toContain('"Enter"');
  });

  it("supports Escape to close palette", () => {
    expect(searchSrc).toContain('"Escape"');
  });
});
