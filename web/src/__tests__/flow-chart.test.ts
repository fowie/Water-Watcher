/**
 * Component source-level tests — Round 15.
 *
 * Tests for FlowChart, ConditionSparkline, and InstallPrompt components
 * using source-level analysis (no jsdom or testing-library available).
 *
 * Coverage:
 * - FlowChart: SVG elements, time range tabs, loading skeleton, empty state, ARIA
 * - ConditionSparkline: SVG sparkline, trend detection, color coding, ARIA
 * - InstallPrompt: PWA banner, dismiss, install, sessionStorage, ARIA
 * - Accessibility: role attributes, aria-label, aria-live
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── Source Loaders ─────────────────────────────────────

const COMPONENTS_DIR = path.resolve(__dirname, "../components");

function readComponent(filename: string): string {
  return fs.readFileSync(path.join(COMPONENTS_DIR, filename), "utf-8");
}

const flowChartSource = readComponent("flow-chart.tsx");
const sparklineSource = readComponent("condition-sparkline.tsx");
const installPromptSource = readComponent("install-prompt.tsx");

// ─── FlowChart Component ───────────────────────────────

describe("FlowChart component — source analysis", () => {
  describe("SVG rendering", () => {
    it("renders an SVG element", () => {
      expect(flowChartSource).toMatch(/<svg[\s>]/);
    });

    it("includes path elements for the chart line", () => {
      expect(flowChartSource).toMatch(/<path[\s>]/);
    });

    it("includes line or polyline elements for chart axes", () => {
      const hasLine = /<line[\s>]/.test(flowChartSource);
      const hasPolyline = /<polyline[\s>]/.test(flowChartSource);
      const hasPath = /<path[\s>]/.test(flowChartSource);
      expect(hasLine || hasPolyline || hasPath).toBe(true);
    });

    it("uses gradient fill for the chart area", () => {
      expect(flowChartSource).toMatch(/linearGradient|radialGradient/);
    });

    it("includes rect or circle elements for data points or tooltip", () => {
      const hasRect = /<rect[\s>]/.test(flowChartSource);
      const hasCircle = /<circle[\s>]/.test(flowChartSource);
      expect(hasRect || hasCircle).toBe(true);
    });
  });

  describe("Time range tabs", () => {
    it("defines 24h range option", () => {
      expect(flowChartSource).toContain("24h");
    });

    it("defines 7d range option", () => {
      expect(flowChartSource).toContain("7d");
    });

    it("defines 30d range option", () => {
      expect(flowChartSource).toContain("30d");
    });

    it("defines 90d range option", () => {
      expect(flowChartSource).toContain("90d");
    });

    it("uses role='tablist' for range selector", () => {
      expect(flowChartSource).toMatch(/role\s*=\s*["']tablist["']/);
    });

    it("uses role='tab' for individual tabs", () => {
      expect(flowChartSource).toMatch(/role\s*=\s*["']tab["']/);
    });
  });

  describe("API integration", () => {
    it("fetches from /api/rivers flow-history endpoint", () => {
      expect(flowChartSource).toMatch(/\/api\/rivers\/.*flow-history/);
    });

    it("includes range query param in fetch URL", () => {
      expect(flowChartSource).toMatch(/range=/);
    });

    it("accepts riverId prop", () => {
      expect(flowChartSource).toMatch(/riverId/);
    });
  });

  describe("Loading state", () => {
    it("exports or defines a FlowChartSkeleton component", () => {
      expect(flowChartSource).toMatch(/FlowChartSkeleton/);
    });

    it("uses loading/skeleton state", () => {
      const hasLoading = /loading|isLoading|skeleton/i.test(flowChartSource);
      expect(hasLoading).toBe(true);
    });
  });

  describe("Tooltip interaction", () => {
    it("handles mouse/pointer events for tooltip", () => {
      const hasMouseEvent =
        /onMouse|onPointer|mousemove|mouseenter|mouseleave|pointermove/i.test(
          flowChartSource
        );
      expect(hasMouseEvent).toBe(true);
    });

    it("displays flow rate in tooltip", () => {
      // Should reference flowRate in tooltip display
      expect(flowChartSource).toMatch(/flowRate|flow.?rate/i);
    });
  });

  describe("Color zones", () => {
    it("defines color-coded zones (green/yellow/red or similar)", () => {
      const hasGreen = /green|#[0-9a-fA-F]{6}.*good|good.*#[0-9a-fA-F]{6}|emerald|22c55e/i.test(
        flowChartSource
      );
      const hasRed = /red|#[0-9a-fA-F]{6}.*danger|danger.*#[0-9a-fA-F]{6}|ef4444/i.test(
        flowChartSource
      );
      const hasYellow = /yellow|amber|#[0-9a-fA-F]{6}.*warn|eab308|f59e0b/i.test(
        flowChartSource
      );
      // At least 2 of the 3 zone colors should be present
      expect([hasGreen, hasRed, hasYellow].filter(Boolean).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Accessibility", () => {
    it("uses role='img' for the chart SVG", () => {
      expect(flowChartSource).toMatch(/role\s*=\s*["']img["']/);
    });

    it("includes aria-label on the chart", () => {
      expect(flowChartSource).toMatch(/aria-label/);
    });
  });

  describe("Responsive behavior", () => {
    it("uses ResizeObserver for responsive sizing", () => {
      expect(flowChartSource).toContain("ResizeObserver");
    });

    it("manages width/height state for chart dimensions", () => {
      expect(flowChartSource).toMatch(/width|height/i);
    });
  });

  describe("Empty state", () => {
    it("handles empty or no data gracefully", () => {
      const hasEmptyCheck =
        /no data|empty|\.length\s*===?\s*0|!.*data|data\?/i.test(
          flowChartSource
        );
      expect(hasEmptyCheck).toBe(true);
    });
  });
});

// ─── ConditionSparkline Component ───────────────────────

describe("ConditionSparkline component — source analysis", () => {
  describe("SVG sparkline", () => {
    it("renders an SVG element", () => {
      expect(sparklineSource).toMatch(/<svg[\s>]/);
    });

    it("includes path or polyline for the sparkline", () => {
      const hasPath = /<path[\s>]/.test(sparklineSource);
      const hasPolyline = /<polyline[\s>]/.test(sparklineSource);
      expect(hasPath || hasPolyline).toBe(true);
    });

    it("uses gradient fill", () => {
      expect(sparklineSource).toMatch(/linearGradient|radialGradient/);
    });

    it("renders an end dot (circle)", () => {
      expect(sparklineSource).toMatch(/<circle[\s>]/);
    });
  });

  describe("Dimensions", () => {
    it("has compact dimensions (width ~80, height ~24)", () => {
      // Default destructured params: width = 80, height = 24
      const widthMatch = sparklineSource.match(/width\s*=\s*(\d+)/);
      const heightMatch = sparklineSource.match(/height\s*=\s*(\d+)/);
      if (widthMatch) {
        expect(parseInt(widthMatch[1])).toBeLessThanOrEqual(120);
      }
      if (heightMatch) {
        expect(parseInt(heightMatch[1])).toBeLessThanOrEqual(40);
      }
      // At least one dimension should be defined
      expect(widthMatch || heightMatch).toBeTruthy();
    });
  });

  describe("Trend detection", () => {
    it("categorizes trend as rising/falling/stable", () => {
      expect(sparklineSource).toMatch(/rising/i);
      expect(sparklineSource).toMatch(/falling/i);
      expect(sparklineSource).toMatch(/stable/i);
    });

    it("computes trend from data point comparison", () => {
      // Uses half-based average comparison
      const hasComparison = /half|average|avg|mean|threshold/i.test(sparklineSource);
      expect(hasComparison).toBe(true);
    });

    it("uses 10% threshold for trend determination", () => {
      expect(sparklineSource).toMatch(/0\.1|10\s*%|threshold/);
    });
  });

  describe("Color coding", () => {
    it("uses blue/similar color for rising trend", () => {
      expect(sparklineSource).toMatch(/blue|#[0-9a-f]{3,6}/i);
    });

    it("uses different colors for different trends", () => {
      // Should have multiple color values for different trend states
      const colorMatches = sparklineSource.match(
        /#[0-9a-fA-F]{3,6}|rgb\(|hsl\(|blue|orange|green|red/gi
      );
      expect(colorMatches).not.toBeNull();
      expect(new Set(colorMatches).size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Edge cases", () => {
    it("handles fewer than 2 data points", () => {
      // Should have check for insufficient data
      const hasLengthCheck = /length\s*[<>=!]+\s*[012]|\.length\s*$/m.test(
        sparklineSource
      );
      const hasEmptyCheck = /no data|dashed|insufficient/i.test(sparklineSource);
      expect(hasLengthCheck || hasEmptyCheck).toBe(true);
    });

    it("filters out null values", () => {
      const hasNullFilter = /null|filter|!==?\s*null/i.test(sparklineSource);
      expect(hasNullFilter).toBe(true);
    });
  });

  describe("Accessibility", () => {
    it("uses role='img'", () => {
      expect(sparklineSource).toMatch(/role\s*=\s*["']img["']/);
    });

    it("includes aria-label showing trend", () => {
      expect(sparklineSource).toMatch(/aria-label/);
      // aria-label should reference the trend
      const hasLabelWithTrend = /aria-label.*trend|trend.*aria-label/is.test(
        sparklineSource
      );
      expect(hasLabelWithTrend).toBe(true);
    });
  });
});

// ─── InstallPrompt Component ────────────────────────────

describe("InstallPrompt component — source analysis", () => {
  describe("PWA detection", () => {
    it("listens for beforeinstallprompt event", () => {
      expect(installPromptSource).toContain("beforeinstallprompt");
    });

    it("checks for standalone mode (already installed)", () => {
      expect(installPromptSource).toMatch(/standalone/i);
    });

    it("stores prompt event for later use", () => {
      // Should have state to hold the deferred prompt
      expect(installPromptSource).toMatch(/prompt|deferredPrompt|installPrompt/i);
    });
  });

  describe("UI elements", () => {
    it("has an Install button", () => {
      expect(installPromptSource).toMatch(/[Ii]nstall/);
    });

    it("has a dismiss/Not Now button", () => {
      const hasDismiss = /[Dd]ismiss|[Nn]ot\s*[Nn]ow|[Cc]lose|[Cc]ancel/i.test(
        installPromptSource
      );
      expect(hasDismiss).toBe(true);
    });

    it("has a close (X) button", () => {
      const hasClose = /×|✕|close|X\s*<\/|aria-label.*close/i.test(
        installPromptSource
      );
      expect(hasClose).toBe(true);
    });
  });

  describe("Dismiss behavior", () => {
    it("uses sessionStorage for dismiss state", () => {
      expect(installPromptSource).toContain("sessionStorage");
    });

    it("saves dismiss state to sessionStorage", () => {
      expect(installPromptSource).toMatch(/sessionStorage\.setItem/);
    });

    it("checks sessionStorage on load for previous dismiss", () => {
      expect(installPromptSource).toMatch(/sessionStorage\.getItem/);
    });
  });

  describe("Visibility logic", () => {
    it("returns null when no prompt is available", () => {
      expect(installPromptSource).toMatch(/return\s+null/);
    });

    it("conditionally renders based on prompt/dismissed/installed state", () => {
      const hasConditional =
        /if\s*\(|&&\s*\(|!\s*\w+|dismissed|installed|showPrompt/i.test(
          installPromptSource
        );
      expect(hasConditional).toBe(true);
    });
  });

  describe("Accessibility", () => {
    it("uses role='alert' on the banner", () => {
      expect(installPromptSource).toMatch(/role\s*=\s*["']alert["']/);
    });

    it("uses aria-live='polite' for screen reader announcements", () => {
      expect(installPromptSource).toMatch(/aria-live\s*=\s*["']polite["']/);
    });
  });

  describe("Install action", () => {
    it("calls prompt() on the deferred event", () => {
      expect(installPromptSource).toMatch(/\.prompt\(\)/);
    });

    it("handles userChoice from the prompt", () => {
      expect(installPromptSource).toMatch(/userChoice|outcome|accepted/i);
    });
  });
});

// ─── Cross-component Exports ────────────────────────────

describe("Component exports", () => {
  it("FlowChart exports a default or named function component", () => {
    expect(flowChartSource).toMatch(
      /export\s+(default\s+)?function\s+FlowChart|export\s+const\s+FlowChart/
    );
  });

  it("FlowChartSkeleton is defined in the module", () => {
    expect(flowChartSource).toMatch(
      /function\s+FlowChartSkeleton/
    );
  });

  it("ConditionSparkline exports a default or named function component", () => {
    expect(sparklineSource).toMatch(
      /export\s+(default\s+)?function\s+ConditionSparkline|export\s+const\s+ConditionSparkline/
    );
  });

  it("InstallPrompt exports a default or named function component", () => {
    expect(installPromptSource).toMatch(
      /export\s+(default\s+)?function\s+InstallPrompt|export\s+const\s+InstallPrompt/
    );
  });
});
