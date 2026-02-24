import { cn } from "@/lib/utils";

interface RapidRatingProps {
  difficulty: string | null;
  className?: string;
}

const difficultyColors: Record<string, string> = {
  "Class I": "bg-green-100 text-green-800 border-green-300",
  "Class II": "bg-green-100 text-green-800 border-green-300",
  "Class III": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "Class IV": "bg-orange-100 text-orange-800 border-orange-300",
  "Class IV+": "bg-orange-200 text-orange-900 border-orange-400",
  "Class V": "bg-red-100 text-red-800 border-red-300",
  "Class V+": "bg-red-200 text-red-900 border-red-400",
};

export function RapidRating({ difficulty, className }: RapidRatingProps) {
  if (!difficulty) return null;

  const colorClass =
    Object.entries(difficultyColors).find(([key]) =>
      difficulty.includes(key)
    )?.[1] ?? "bg-gray-100 text-gray-800 border-gray-300";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        colorClass,
        className
      )}
    >
      {difficulty}
    </span>
  );
}
