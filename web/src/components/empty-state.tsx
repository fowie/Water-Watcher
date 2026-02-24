import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn("text-center py-20 space-y-4", className)}>
      <div className="flex justify-center">
        <div className="rounded-full bg-[var(--muted)] p-4">
          <Icon className="h-10 w-10 text-[var(--muted-foreground)]" />
        </div>
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto">
        {description}
      </p>
      {children}
    </div>
  );
}
