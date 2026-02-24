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

export function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 0) return "just now";
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
