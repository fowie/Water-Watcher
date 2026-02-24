import { Badge } from "@/components/ui/badge";
import type { HazardSeverity } from "@/types";

const severityConfig: Record<
  HazardSeverity,
  { variant: "info" | "warning" | "danger" }
> = {
  info: { variant: "info" },
  warning: { variant: "warning" },
  danger: { variant: "danger" },
};

interface HazardBadgeProps {
  severity: HazardSeverity;
  type: string;
}

export function HazardBadge({ severity, type }: HazardBadgeProps) {
  const config = severityConfig[severity] ?? { variant: "secondary" as const };
  const label = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant={config.variant}>{label}</Badge>;
}
