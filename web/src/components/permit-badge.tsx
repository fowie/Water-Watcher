"use client";

import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface PermitBadgeProps {
  required: boolean;
  url?: string | null;
  className?: string;
}

export function PermitBadge({ required, url, className }: PermitBadgeProps) {
  if (!required) return null;

  const badgeContent = (
    <Badge
      variant="secondary"
      className={`bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800 ${className ?? ""}`}
    >
      📋 Permit Required
      {url && <ExternalLink className="h-3 w-3 ml-1" aria-hidden="true" />}
    </Badge>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex"
        aria-label="View permit information (opens in new tab)"
      >
        {badgeContent}
      </a>
    );
  }

  return badgeContent;
}
