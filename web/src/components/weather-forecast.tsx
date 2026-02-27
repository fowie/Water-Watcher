"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Droplets,
  MapPin,
} from "lucide-react";

interface WeatherForecastProps {
  riverId: string;
}

interface ForecastDay {
  date: string;
  tempHigh: number;
  tempLow: number;
  condition: string;
  conditionCode: number;
  precipChance: number;
  icon: string;
}

interface WeatherForecastData {
  forecast: ForecastDay[];
  location: string | null;
}

function getConditionIcon(code: number) {
  if (code === 0 || code === 1)
    return <Sun className="h-6 w-6 text-yellow-500" aria-hidden="true" />;
  if (code === 2 || code === 3)
    return <Cloud className="h-6 w-6 text-gray-400" aria-hidden="true" />;
  if (code >= 45 && code <= 48)
    return <CloudFog className="h-6 w-6 text-gray-400" aria-hidden="true" />;
  if (code >= 51 && code <= 57)
    return <CloudDrizzle className="h-6 w-6 text-blue-400" aria-hidden="true" />;
  if (code >= 61 && code <= 67)
    return <CloudRain className="h-6 w-6 text-blue-500" aria-hidden="true" />;
  if (code >= 71 && code <= 77)
    return <CloudSnow className="h-6 w-6 text-blue-200" aria-hidden="true" />;
  if (code >= 80 && code <= 82)
    return <CloudRain className="h-6 w-6 text-blue-500" aria-hidden="true" />;
  if (code >= 85 && code <= 86)
    return <CloudSnow className="h-6 w-6 text-blue-200" aria-hidden="true" />;
  if (code >= 95 && code <= 99)
    return (
      <CloudLightning className="h-6 w-6 text-yellow-600" aria-hidden="true" />
    );
  return <Sun className="h-6 w-6 text-yellow-500" aria-hidden="true" />;
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.round(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function WeatherForecast({ riverId }: WeatherForecastProps) {
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async () => {
    try {
      const res = await fetch(`/api/rivers/${riverId}/weather`);
      if (!res.ok) {
        setError("Weather data unavailable");
        return;
      }
      const data: WeatherForecastData = await res.json();
      setForecast(data.forecast ?? []);
    } catch {
      setError("Weather data unavailable");
    } finally {
      setLoading(false);
    }
  }, [riverId]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">5-Day Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 min-w-[72px]">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || forecast.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">5-Day Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-sm text-[var(--muted-foreground)]">
            <MapPin className="h-6 w-6 mx-auto mb-2 opacity-50" aria-hidden="true" />
            <p>{error ?? "No forecast data available"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">5-Day Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {forecast.slice(0, 5).map((day) => (
            <div
              key={day.date}
              className="flex flex-col items-center gap-1.5 min-w-[72px] p-2 rounded-lg bg-[var(--muted)]/30 hover:bg-[var(--muted)]/60 transition-colors"
            >
              <span className="text-xs font-medium">
                {formatDayLabel(day.date)}
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {formatDate(day.date)}
              </span>
              {getConditionIcon(day.conditionCode)}
              <div className="text-center">
                <span className="text-sm font-semibold">{day.tempHigh}°</span>
                <span className="text-xs text-[var(--muted-foreground)] ml-1">
                  {day.tempLow}°
                </span>
              </div>
              {day.precipChance > 0 && (
                <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
                  <Droplets className="h-2.5 w-2.5" aria-hidden="true" />
                  {day.precipChance}%
                </span>
              )}
              <span className="text-[10px] text-[var(--muted-foreground)] text-center leading-tight">
                {day.condition}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
