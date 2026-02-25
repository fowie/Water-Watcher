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
  Wind,
  Droplets,
  Thermometer,
  MapPin,
} from "lucide-react";

interface WeatherWidgetProps {
  latitude: number | null;
  longitude: number | null;
}

interface CurrentWeather {
  temperature: number; // °F
  precipitation: number; // mm
  windSpeed: number; // mph
  weatherCode: number;
}

interface DailyForecast {
  date: string;
  tempMax: number; // °F
  tempMin: number; // °F
  precipitationSum: number; // mm
  weatherCode: number;
}

function celsiusToFahrenheit(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

function kphToMph(kph: number): number {
  return Math.round(kph * 0.621371);
}

function getWeatherDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Unknown";
}

function getWeatherIcon(code: number) {
  if (code === 0 || code === 1) return <Sun className="h-6 w-6 text-yellow-500" aria-hidden="true" />;
  if (code === 2 || code === 3) return <Cloud className="h-6 w-6 text-gray-400" aria-hidden="true" />;
  if (code >= 45 && code <= 48) return <CloudFog className="h-6 w-6 text-gray-400" aria-hidden="true" />;
  if (code >= 51 && code <= 57) return <CloudDrizzle className="h-6 w-6 text-blue-400" aria-hidden="true" />;
  if (code >= 61 && code <= 67) return <CloudRain className="h-6 w-6 text-blue-500" aria-hidden="true" />;
  if (code >= 71 && code <= 77) return <CloudSnow className="h-6 w-6 text-blue-200" aria-hidden="true" />;
  if (code >= 80 && code <= 82) return <CloudRain className="h-6 w-6 text-blue-500" aria-hidden="true" />;
  if (code >= 85 && code <= 86) return <CloudSnow className="h-6 w-6 text-blue-200" aria-hidden="true" />;
  if (code >= 95 && code <= 99) return <CloudLightning className="h-6 w-6 text-yellow-600" aria-hidden="true" />;
  return <Sun className="h-6 w-6 text-yellow-500" aria-hidden="true" />;
}

function getSmallWeatherIcon(code: number) {
  if (code === 0 || code === 1) return <Sun className="h-5 w-5 text-yellow-500" aria-hidden="true" />;
  if (code === 2 || code === 3) return <Cloud className="h-5 w-5 text-gray-400" aria-hidden="true" />;
  if (code >= 45 && code <= 48) return <CloudFog className="h-5 w-5 text-gray-400" aria-hidden="true" />;
  if (code >= 51 && code <= 57) return <CloudDrizzle className="h-5 w-5 text-blue-400" aria-hidden="true" />;
  if (code >= 61 && code <= 67) return <CloudRain className="h-5 w-5 text-blue-500" aria-hidden="true" />;
  if (code >= 71 && code <= 77) return <CloudSnow className="h-5 w-5 text-blue-200" aria-hidden="true" />;
  if (code >= 80 && code <= 82) return <CloudRain className="h-5 w-5 text-blue-500" aria-hidden="true" />;
  if (code >= 85 && code <= 86) return <CloudSnow className="h-5 w-5 text-blue-200" aria-hidden="true" />;
  if (code >= 95 && code <= 99) return <CloudLightning className="h-5 w-5 text-yellow-600" aria-hidden="true" />;
  return <Sun className="h-5 w-5 text-yellow-500" aria-hidden="true" />;
}

function formatDayName(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export function WeatherWidget({ latitude, longitude }: WeatherWidgetProps) {
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    if (latitude == null || longitude == null) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto&forecast_days=3`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch weather");
      const data = await res.json();

      setCurrent({
        temperature: celsiusToFahrenheit(data.current.temperature_2m),
        precipitation: data.current.precipitation,
        windSpeed: kphToMph(data.current.wind_speed_10m),
        weatherCode: data.current.weather_code,
      });

      const days: DailyForecast[] = data.daily.time.map((t: string, i: number) => ({
        date: t,
        tempMax: celsiusToFahrenheit(data.daily.temperature_2m_max[i]),
        tempMin: celsiusToFahrenheit(data.daily.temperature_2m_min[i]),
        precipitationSum: data.daily.precipitation_sum[i],
        weatherCode: data.daily.weather_code[i],
      }));
      setForecast(days);
    } catch {
      setError("Unable to load weather data");
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  if (latitude == null || longitude == null) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <MapPin className="h-8 w-8 mx-auto text-[var(--muted-foreground)] mb-2" aria-hidden="true" />
          <p className="text-sm text-[var(--muted-foreground)]">
            No location data available for weather forecast.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-20" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !current) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Cloud className="h-8 w-8 mx-auto text-[var(--muted-foreground)] mb-2" aria-hidden="true" />
          <p className="text-sm text-[var(--muted-foreground)]">
            {error ?? "Weather data unavailable"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {getWeatherIcon(current.weatherCode)}
          Current Weather
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current conditions */}
        <div className="flex items-center gap-4">
          <span className="text-4xl font-bold">{current.temperature}°F</span>
          <div className="space-y-0.5 text-sm text-[var(--muted-foreground)]">
            <p className="font-medium text-[var(--foreground)]">
              {getWeatherDescription(current.weatherCode)}
            </p>
            <p className="flex items-center gap-1">
              <Wind className="h-3.5 w-3.5" aria-hidden="true" />
              {current.windSpeed} mph
            </p>
            <p className="flex items-center gap-1">
              <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
              {current.precipitation} mm precip
            </p>
          </div>
        </div>

        {/* 3-day forecast */}
        {forecast.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {forecast.map((day) => (
              <div
                key={day.date}
                className="rounded-lg border border-[var(--border)] p-3 text-center space-y-1"
              >
                <p className="text-xs font-medium text-[var(--muted-foreground)]">
                  {formatDayName(day.date)}
                </p>
                <div className="flex justify-center">
                  {getSmallWeatherIcon(day.weatherCode)}
                </div>
                <p className="text-sm font-semibold">
                  {day.tempMax}°
                  <span className="text-[var(--muted-foreground)] font-normal ml-1">
                    {day.tempMin}°
                  </span>
                </p>
                {day.precipitationSum > 0 && (
                  <p className="text-xs text-blue-500 flex items-center justify-center gap-0.5">
                    <Droplets className="h-3 w-3" aria-hidden="true" />
                    {day.precipitationSum.toFixed(1)}mm
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
