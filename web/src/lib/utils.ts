import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFlowRate(cfs: number | null | undefined): string {
  if (cfs == null) return "N/A";
  return `${cfs.toLocaleString()} CFS`;
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null) return "Price not listed";
  return `$${price.toFixed(0)}`;
}

export function qualityColor(quality: string | null | undefined): string {
  switch (quality) {
    case "excellent":
      return "text-green-600";
    case "good":
      return "text-blue-600";
    case "fair":
      return "text-yellow-600";
    case "poor":
      return "text-orange-600";
    case "dangerous":
      return "text-red-600";
    default:
      return "text-gray-500";
  }
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "danger":
      return "text-red-600 bg-red-50";
    case "warning":
      return "text-yellow-700 bg-yellow-50";
    case "info":
      return "text-blue-600 bg-blue-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}
