import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface MapLinkProps {
  latitude: number;
  longitude: number;
  label?: string;
  className?: string;
  /** Show the label text alongside the icon */
  showLabel?: boolean;
}

export function MapLink({
  latitude,
  longitude,
  label,
  className,
  showLabel = false,
}: MapLinkProps) {
  const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const displayLabel = label ?? "View on map";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-[var(--primary)] hover:underline transition-colors",
        className
      )}
      aria-label={`Open ${displayLabel} in Google Maps`}
      title={`Open ${displayLabel} in Google Maps`}
    >
      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
      {showLabel && (
        <span className="text-xs">{displayLabel}</span>
      )}
    </a>
  );
}
