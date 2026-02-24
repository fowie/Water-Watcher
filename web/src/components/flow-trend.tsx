import { cn } from "@/lib/utils";

interface FlowTrendProps {
  conditions: { flowRate: number | null }[];
  className?: string;
}

/**
 * Shows a trend arrow comparing the two most recent flow rate readings.
 * Rising = flow increased >10%, falling = decreased >10%, stable = within 10%.
 */
export function FlowTrend({ conditions, className }: FlowTrendProps) {
  const readings = conditions
    .map((c) => c.flowRate)
    .filter((f): f is number => f != null);

  if (readings.length < 2) return null;

  const current = readings[0];
  const previous = readings[1];

  if (previous === 0 && current === 0) {
    return (
      <span
        className={cn("inline-flex items-center text-sm font-medium text-gray-500", className)}
        title="Stable"
        aria-label="Flow rate stable"
      >
        →
      </span>
    );
  }

  const changeRatio = previous !== 0 ? (current - previous) / Math.abs(previous) : 0;

  let arrow: string;
  let color: string;
  let label: string;

  if (changeRatio > 0.1) {
    arrow = "↑";
    color = "text-blue-600";
    label = "Rising";
  } else if (changeRatio < -0.1) {
    arrow = "↓";
    color = "text-orange-600";
    label = "Falling";
  } else {
    arrow = "→";
    color = "text-gray-500";
    label = "Stable";
  }

  return (
    <span
      className={cn("inline-flex items-center text-sm font-medium", color, className)}
      title={label}
      aria-label={`Flow rate ${label.toLowerCase()}`}
    >
      {arrow}
    </span>
  );
}
