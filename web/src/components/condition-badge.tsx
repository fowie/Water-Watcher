import { Badge } from "@/components/ui/badge";
import type { RiverQuality } from "@/types";

const qualityConfig: Record<
  RiverQuality,
  { label: string; variant: "success" | "info" | "warning" | "danger" | "secondary" }
> = {
  excellent: { label: "Excellent", variant: "success" },
  good: { label: "Good", variant: "info" },
  fair: { label: "Fair", variant: "warning" },
  poor: { label: "Poor", variant: "danger" },
  dangerous: { label: "Dangerous", variant: "danger" },
};

interface ConditionBadgeProps {
  quality: RiverQuality;
}

export function ConditionBadge({ quality }: ConditionBadgeProps) {
  const config = qualityConfig[quality] ?? {
    label: quality,
    variant: "secondary" as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
