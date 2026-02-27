"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────

interface FlowDataPoint {
  timestamp: string;
  flowRate: number;
}

interface FlowHistoryResponse {
  data: FlowDataPoint[];
  riverId: string;
  range: string;
}

type TimeRange = "24h" | "7d" | "30d" | "90d";

interface FlowChartProps {
  riverId: string;
  /** Optional flow thresholds for color-coded zones */
  thresholds?: {
    optimal: number; // below this = green
    high: number; // below this = yellow, above = red
  };
  className?: string;
}

// ─── Constants ──────────────────────────────────────────

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

const CHART_PADDING = { top: 20, right: 16, bottom: 40, left: 60 };
const DEFAULT_THRESHOLDS = { optimal: 2000, high: 5000 };

// ─── Component ──────────────────────────────────────────

export function FlowChart({
  riverId,
  thresholds = DEFAULT_THRESHOLDS,
  className,
}: FlowChartProps) {
  const [range, setRange] = useState<TimeRange>("7d");
  const [data, setData] = useState<FlowDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    point: FlowDataPoint;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 300 });

  // Responsive sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setDimensions({
          width: Math.max(300, width),
          height: Math.max(200, Math.min(350, width * 0.5)),
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/rivers/${riverId}/flow-history?range=${range}`
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch flow history: ${res.status}`);
      }
      const json: FlowHistoryResponse = await res.json();
      setData(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [riverId, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Chart calculations
  const chartArea = useMemo(() => {
    const w = dimensions.width - CHART_PADDING.left - CHART_PADDING.right;
    const h = dimensions.height - CHART_PADDING.top - CHART_PADDING.bottom;
    return { w, h };
  }, [dimensions]);

  const { minFlow, maxFlow, minTime, maxTime } = useMemo(() => {
    if (data.length === 0) {
      return { minFlow: 0, maxFlow: 1000, minTime: 0, maxTime: 1 };
    }
    const flows = data.map((d) => d.flowRate);
    const times = data.map((d) => new Date(d.timestamp).getTime());
    const min = Math.min(...flows);
    const max = Math.max(...flows);
    const padding = (max - min) * 0.1 || 100;
    return {
      minFlow: Math.max(0, min - padding),
      maxFlow: max + padding,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
    };
  }, [data]);

  // Map data to SVG coordinates
  const toX = useCallback(
    (timestamp: string) => {
      const t = new Date(timestamp).getTime();
      const timeRange = maxTime - minTime || 1;
      return CHART_PADDING.left + ((t - minTime) / timeRange) * chartArea.w;
    },
    [minTime, maxTime, chartArea.w]
  );

  const toY = useCallback(
    (flow: number) => {
      const flowRange = maxFlow - minFlow || 1;
      return (
        CHART_PADDING.top +
        chartArea.h -
        ((flow - minFlow) / flowRange) * chartArea.h
      );
    },
    [minFlow, maxFlow, chartArea.h]
  );

  // Build SVG path
  const linePath = useMemo(() => {
    if (data.length === 0) return "";
    return data
      .map((d, i) => {
        const x = toX(d.timestamp);
        const y = toY(d.flowRate);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [data, toX, toY]);

  // Area path for gradient fill
  const areaPath = useMemo(() => {
    if (data.length === 0) return "";
    const baseline = CHART_PADDING.top + chartArea.h;
    const first = data[0];
    const last = data[data.length - 1];
    return `${linePath} L ${toX(last.timestamp)} ${baseline} L ${toX(first.timestamp)} ${baseline} Z`;
  }, [data, linePath, toX, chartArea.h]);

  // Color zones
  const zoneRects = useMemo(() => {
    const zones = [];
    const yOptimal = toY(thresholds.optimal);
    const yHigh = toY(thresholds.high);
    const chartBottom = CHART_PADDING.top + chartArea.h;
    const chartTop = CHART_PADDING.top;

    // Green zone (0 to optimal)
    if (thresholds.optimal > minFlow) {
      zones.push({
        y: Math.max(chartTop, yOptimal),
        height: chartBottom - Math.max(chartTop, yOptimal),
        color: "rgba(34, 197, 94, 0.06)",
      });
    }

    // Yellow zone (optimal to high)
    if (thresholds.high > minFlow && thresholds.optimal < maxFlow) {
      const top = Math.max(chartTop, yHigh);
      const bottom = Math.min(chartBottom, yOptimal);
      if (bottom > top) {
        zones.push({ y: top, height: bottom - top, color: "rgba(234, 179, 8, 0.06)" });
      }
    }

    // Red zone (above high)
    if (maxFlow > thresholds.high) {
      const bottom = Math.min(chartBottom, yHigh);
      if (bottom > chartTop) {
        zones.push({ y: chartTop, height: bottom - chartTop, color: "rgba(239, 68, 68, 0.06)" });
      }
    }

    return zones;
  }, [thresholds, toY, minFlow, maxFlow, chartArea.h]);

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const tickCount = 5;
    const range = maxFlow - minFlow || 1;
    const step = range / tickCount;
    return Array.from({ length: tickCount + 1 }, (_, i) => {
      const value = minFlow + step * i;
      return { value, y: toY(value) };
    });
  }, [minFlow, maxFlow, toY]);

  // X-axis ticks
  const xTicks = useMemo(() => {
    const tickCount = Math.min(data.length, 6);
    if (data.length === 0) return [];
    const step = Math.max(1, Math.floor(data.length / tickCount));
    const ticks: { label: string; x: number }[] = [];
    for (let i = 0; i < data.length; i += step) {
      const d = data[i];
      const date = new Date(d.timestamp);
      let label: string;
      if (range === "24h") {
        label = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (range === "7d") {
        label = date.toLocaleDateString([], { weekday: "short" });
      } else {
        label = date.toLocaleDateString([], { month: "short", day: "numeric" });
      }
      ticks.push({ label, x: toX(d.timestamp) });
    }
    return ticks;
  }, [data, range, toX]);

  // Get line color for a flow value
  const getFlowColor = (flow: number) => {
    if (flow >= thresholds.high) return "var(--destructive, #ef4444)";
    if (flow >= thresholds.optimal) return "#eab308";
    return "#22c55e";
  };

  // Tooltip on mousemove
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (data.length === 0) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      // Find nearest data point
      let closest = data[0];
      let closestDist = Infinity;
      for (const d of data) {
        const dx = Math.abs(toX(d.timestamp) - mouseX);
        if (dx < closestDist) {
          closestDist = dx;
          closest = d;
        }
      }

      if (closestDist < 50) {
        setTooltip({
          x: toX(closest.timestamp),
          y: toY(closest.flowRate),
          point: closest,
        });
      } else {
        setTooltip(null);
      }
    },
    [data, toX, toY]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Format tooltip timestamp
  const formatTooltipTime = (timestamp: string) => {
    const d = new Date(timestamp);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ─── Render ───────────────────────────────────────────

  return (
    <div className={cn("space-y-3", className)} ref={containerRef}>
      {/* Range tabs */}
      <div className="flex items-center gap-1" role="tablist" aria-label="Time range">
        {RANGES.map((r) => (
          <button
            key={r.value}
            role="tab"
            aria-selected={range === r.value}
            aria-label={`Show ${r.label} flow history`}
            onClick={() => setRange(r.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              range === r.value
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
            )}
          >
            {r.label}
          </button>
        ))}
        {/* Legend */}
        <div className="ml-auto flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
            Optimal
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" />
            High
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
            Dangerous
          </span>
        </div>
      </div>

      {/* Chart area */}
      {loading ? (
        <FlowChartSkeleton height={dimensions.height} />
      ) : error ? (
        <div className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 text-sm text-[var(--muted-foreground)]" style={{ height: dimensions.height }}>
          {error}
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 text-sm text-[var(--muted-foreground)]" style={{ height: dimensions.height }}>
          No flow data available for this period
        </div>
      ) : (
        <div className="relative rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden">
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="w-full"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            role="img"
            aria-label={`Flow rate chart showing ${data.length} data points over ${range}`}
          >
            <defs>
              <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary, #0ea5e9)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--primary, #0ea5e9)" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Color zone backgrounds */}
            {zoneRects.map((zone, i) => (
              <rect
                key={i}
                x={CHART_PADDING.left}
                y={zone.y}
                width={chartArea.w}
                height={zone.height}
                fill={zone.color}
              />
            ))}

            {/* Grid lines */}
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={CHART_PADDING.left}
                  y1={tick.y}
                  x2={CHART_PADDING.left + chartArea.w}
                  y2={tick.y}
                  stroke="var(--border, #e2e8f0)"
                  strokeWidth={0.5}
                  strokeDasharray="4 4"
                />
                <text
                  x={CHART_PADDING.left - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--muted-foreground, #64748b)"
                >
                  {tick.value >= 1000
                    ? `${(tick.value / 1000).toFixed(1)}k`
                    : Math.round(tick.value)}
                </text>
              </g>
            ))}

            {/* X-axis ticks */}
            {xTicks.map((tick, i) => (
              <text
                key={i}
                x={tick.x}
                y={CHART_PADDING.top + chartArea.h + 20}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted-foreground, #64748b)"
              >
                {tick.label}
              </text>
            ))}

            {/* Y-axis label */}
            <text
              x={14}
              y={CHART_PADDING.top + chartArea.h / 2}
              textAnchor="middle"
              fontSize={10}
              fill="var(--muted-foreground, #64748b)"
              transform={`rotate(-90 14 ${CHART_PADDING.top + chartArea.h / 2})`}
            >
              CFS
            </text>

            {/* Area fill */}
            <path d={areaPath} fill="url(#flowGradient)" />

            {/* Line */}
            <path
              d={linePath}
              fill="none"
              stroke="var(--primary, #0ea5e9)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Threshold lines */}
            {thresholds.optimal <= maxFlow && thresholds.optimal >= minFlow && (
              <line
                x1={CHART_PADDING.left}
                y1={toY(thresholds.optimal)}
                x2={CHART_PADDING.left + chartArea.w}
                y2={toY(thresholds.optimal)}
                stroke="#22c55e"
                strokeWidth={1}
                strokeDasharray="6 3"
                opacity={0.5}
              />
            )}
            {thresholds.high <= maxFlow && thresholds.high >= minFlow && (
              <line
                x1={CHART_PADDING.left}
                y1={toY(thresholds.high)}
                x2={CHART_PADDING.left + chartArea.w}
                y2={toY(thresholds.high)}
                stroke="#ef4444"
                strokeWidth={1}
                strokeDasharray="6 3"
                opacity={0.5}
              />
            )}

            {/* Data points (visible on hover proximity) */}
            {data.map((d, i) => (
              <circle
                key={i}
                cx={toX(d.timestamp)}
                cy={toY(d.flowRate)}
                r={tooltip?.point === d ? 5 : 2}
                fill={getFlowColor(d.flowRate)}
                stroke="var(--background, #fff)"
                strokeWidth={tooltip?.point === d ? 2 : 0}
                opacity={tooltip?.point === d ? 1 : 0}
                className="transition-opacity duration-150"
              />
            ))}

            {/* Tooltip crosshair */}
            {tooltip && (
              <>
                <line
                  x1={tooltip.x}
                  y1={CHART_PADDING.top}
                  x2={tooltip.x}
                  y2={CHART_PADDING.top + chartArea.h}
                  stroke="var(--muted-foreground, #64748b)"
                  strokeWidth={0.5}
                  strokeDasharray="3 3"
                />
                <line
                  x1={CHART_PADDING.left}
                  y1={tooltip.y}
                  x2={CHART_PADDING.left + chartArea.w}
                  y2={tooltip.y}
                  stroke="var(--muted-foreground, #64748b)"
                  strokeWidth={0.5}
                  strokeDasharray="3 3"
                />
              </>
            )}
          </svg>

          {/* Tooltip overlay */}
          {tooltip && (
            <div
              className="absolute pointer-events-none z-10 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg px-3 py-2 text-xs"
              style={{
                left: Math.min(
                  tooltip.x + 12,
                  dimensions.width - 160
                ),
                top: Math.max(tooltip.y - 60, 4),
              }}
            >
              <p className="font-semibold text-[var(--foreground)]">
                {tooltip.point.flowRate.toLocaleString()} CFS
              </p>
              <p className="text-[var(--muted-foreground)] mt-0.5">
                {formatTooltipTime(tooltip.point.timestamp)}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: getFlowColor(tooltip.point.flowRate) }}
                />
                <span className="text-[var(--muted-foreground)]">
                  {tooltip.point.flowRate >= thresholds.high
                    ? "Dangerous"
                    : tooltip.point.flowRate >= thresholds.optimal
                    ? "High"
                    : "Optimal"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────

function FlowChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 space-y-3"
      style={{ height }}
      role="status"
      aria-label="Loading flow chart"
    >
      <div className="flex items-end gap-2 h-full pb-8">
        {/* Fake bar chart skeleton */}
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{
              height: `${30 + Math.random() * 50}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
