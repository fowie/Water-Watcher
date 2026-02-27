"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface ConditionSparklineProps {
  /** Array of flow rate values (most recent last, or most recent first — component handles both) */
  data: (number | null)[];
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  className?: string;
  /** Accessible label */
  label?: string;
}

/**
 * A tiny inline SVG sparkline (~80x24px) showing flow rate trend over time.
 * Designed for use on river cards for at-a-glance trend info.
 */
export function ConditionSparkline({
  data,
  width = 80,
  height = 24,
  className,
  label = "Flow trend",
}: ConditionSparklineProps) {
  // Filter out nulls and work with numeric values only
  const values = useMemo(() => data.filter((v): v is number => v != null), [data]);

  const { path, gradientPath, color, trendLabel } = useMemo(() => {
    if (values.length < 2) {
      return { path: "", gradientPath: "", color: "#94a3b8", trendLabel: "insufficient data" };
    }

    const padding = 2;
    const w = width - padding * 2;
    const h = height - padding * 2;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => ({
      x: padding + (i / (values.length - 1)) * w,
      y: padding + h - ((v - min) / range) * h,
    }));

    // Build line path
    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    // Build filled area path
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`;

    // Determine trend by comparing first half average to second half
    const mid = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, mid);
    const secondHalf = values.slice(mid);
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const changeRatio = avgFirst !== 0 ? (avgSecond - avgFirst) / Math.abs(avgFirst) : 0;

    let lineColor: string;
    let tLabel: string;
    if (changeRatio > 0.1) {
      lineColor = "#3b82f6"; // blue — rising
      tLabel = "rising";
    } else if (changeRatio < -0.1) {
      lineColor = "#f97316"; // orange — falling
      tLabel = "falling";
    } else {
      lineColor = "#22c55e"; // green — stable
      tLabel = "stable";
    }

    return { path: linePath, gradientPath: areaPath, color: lineColor, trendLabel: tLabel };
  }, [values, width, height]);

  if (values.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("inline-block", className)}
        role="img"
        aria-label={`${label}: no data`}
      >
        {/* Flat line indicating no data */}
        <line
          x1={4}
          y1={height / 2}
          x2={width - 4}
          y2={height / 2}
          stroke="#94a3b8"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.5}
        />
      </svg>
    );
  }

  // Unique ID for gradient
  const gradientId = `sparkline-grad-${useMemo(() => Math.random().toString(36).slice(2, 8), [])}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block", className)}
      role="img"
      aria-label={`${label}: ${trendLabel}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={gradientPath} fill={`url(#${gradientId})`} />

      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot */}
      <circle
        cx={width - 2}
        cy={(() => {
          const lastVal = values[values.length - 1];
          const min = Math.min(...values);
          const max = Math.max(...values);
          const range = max - min || 1;
          return 2 + (height - 4) - ((lastVal - min) / range) * (height - 4);
        })()}
        r={2}
        fill={color}
      />
    </svg>
  );
}
