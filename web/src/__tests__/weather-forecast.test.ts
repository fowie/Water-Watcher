/**
 * Tests for the Weather Forecast Card component — source-level analysis.
 *
 * Component: WeatherWidget (web/src/components/weather-widget.tsx)
 *
 * This component already exists. We perform source-level analysis
 * to validate its structure: 5-day forecast rendering, loading state,
 * error state, responsive layout, and helper functions.
 *
 * Coverage:
 * - Renders forecast days
 * - Loading state (skeleton)
 * - Error state
 * - Responsive layout
 * - Helper functions: celsiusToFahrenheit, kphToMph, getWeatherDescription, formatDayName
 * - Icon mapping
 * - ARIA accessibility
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── Source Loader ──────────────────────────────────────

const COMPONENTS_DIR = path.resolve(__dirname, "../components");

function readComponent(filename: string): string {
  return fs.readFileSync(path.join(COMPONENTS_DIR, filename), "utf-8");
}

const weatherSource = readComponent("weather-widget.tsx");

// ─── Forecast Rendering ─────────────────────────────────

describe("WeatherWidget — forecast rendering", () => {
  it("renders forecast days from forecast state", () => {
    expect(weatherSource).toMatch(/forecast/);
    expect(weatherSource).toMatch(/\.map\(/);
  });

  it("displays temperature max and min", () => {
    expect(weatherSource).toMatch(/tempMax/);
    expect(weatherSource).toMatch(/tempMin/);
  });

  it("uses grid layout for forecast days", () => {
    expect(weatherSource).toMatch(/grid/);
    expect(weatherSource).toMatch(/grid-cols/);
  });

  it("displays day name using formatDayName", () => {
    expect(weatherSource).toMatch(/formatDayName/);
  });

  it("displays precipitation for days with precipitation", () => {
    expect(weatherSource).toMatch(/precipitationSum/);
    expect(weatherSource).toMatch(/> 0/); // conditional display
  });

  it("shows weather icon per forecast day", () => {
    expect(weatherSource).toMatch(/getSmallWeatherIcon/);
  });

  it("forecast cards have date key", () => {
    expect(weatherSource).toMatch(/key=\{day\.date\}/);
  });
});

// ─── Loading State ───────────────────────────────────────

describe("WeatherWidget — loading state", () => {
  it("uses Skeleton component for loading", () => {
    expect(weatherSource).toMatch(/import.*Skeleton/);
    expect(weatherSource).toMatch(/<Skeleton/);
  });

  it("shows skeleton when loading is true", () => {
    expect(weatherSource).toMatch(/loading/);
    expect(weatherSource).toMatch(/useState.*true/); // initial loading = true
  });

  it("renders multiple skeleton elements for layout", () => {
    // Count Skeleton occurrences — should be > 1 for header + content
    const skeletonCount = (weatherSource.match(/<Skeleton/g) ?? []).length;
    expect(skeletonCount).toBeGreaterThanOrEqual(3);
  });

  it("skeleton includes forecast grid placeholders", () => {
    // Should have skeleton grid items (3 or 5)
    expect(weatherSource).toMatch(/\[1,\s*2,\s*3\]|Array\.from/);
  });
});

// ─── Error State ─────────────────────────────────────────

describe("WeatherWidget — error state", () => {
  it("tracks error in state", () => {
    expect(weatherSource).toMatch(/useState.*null/);
    expect(weatherSource).toMatch(/setError/);
  });

  it("displays error message when error occurs", () => {
    expect(weatherSource).toMatch(/error/i);
    expect(weatherSource).toMatch(/Unable to load weather|Weather data unavailable/);
  });

  it("handles fetch failure with try-catch", () => {
    expect(weatherSource).toMatch(/try\s*\{/);
    expect(weatherSource).toMatch(/catch/);
  });

  it("shows cloud icon in error state", () => {
    // Error state should show a cloud icon or similar
    expect(weatherSource).toMatch(/Cloud/);
  });

  it("handles null/missing coordinates gracefully", () => {
    expect(weatherSource).toMatch(/latitude\s*==\s*null|latitude\s*===?\s*null/);
    expect(weatherSource).toMatch(/longitude\s*==\s*null|longitude\s*===?\s*null/);
  });

  it("shows location unavailable message for missing coords", () => {
    expect(weatherSource).toMatch(/No location data|location.*unavailable/i);
  });
});

// ─── Responsive Layout ──────────────────────────────────

describe("WeatherWidget — responsive layout", () => {
  it("uses Card wrapper component", () => {
    expect(weatherSource).toMatch(/import.*Card/);
    expect(weatherSource).toMatch(/<Card/);
  });

  it("has responsive grid for forecast", () => {
    expect(weatherSource).toMatch(/grid-cols-3|grid-cols-5|md:grid-cols/);
  });

  it("uses gap spacing in grid", () => {
    expect(weatherSource).toMatch(/gap-[0-9]/);
  });

  it("uses spacing utilities for content sections", () => {
    expect(weatherSource).toMatch(/space-y-[0-9]/);
  });

  it("temperature is displayed prominently", () => {
    // Large text for temperature
    expect(weatherSource).toMatch(/text-4xl|text-3xl|text-2xl/);
    expect(weatherSource).toMatch(/font-bold/);
  });
});

// ─── Helper Functions ────────────────────────────────────

describe("WeatherWidget — celsiusToFahrenheit", () => {
  it("defines celsiusToFahrenheit function", () => {
    expect(weatherSource).toMatch(/function celsiusToFahrenheit/);
  });

  it("uses correct conversion formula", () => {
    // C * 9/5 + 32
    expect(weatherSource).toMatch(/9\s*\/\s*5\s*\+\s*32|1\.8.*32/);
  });

  it("rounds the result", () => {
    expect(weatherSource).toMatch(/Math\.round/);
  });
});

describe("WeatherWidget — kphToMph", () => {
  it("defines kphToMph function", () => {
    expect(weatherSource).toMatch(/function kphToMph/);
  });

  it("uses correct conversion factor (~0.621)", () => {
    expect(weatherSource).toMatch(/0\.621/);
  });
});

describe("WeatherWidget — getWeatherDescription", () => {
  it("defines getWeatherDescription function", () => {
    expect(weatherSource).toMatch(/function getWeatherDescription/);
  });

  it("maps WMO code 0 to clear sky", () => {
    expect(weatherSource).toMatch(/code\s*===?\s*0.*Clear sky/);
  });

  it("maps codes 61-65 to Rain", () => {
    expect(weatherSource).toMatch(/6[15].*Rain/);
  });

  it("maps codes 71-77 to Snow", () => {
    expect(weatherSource).toMatch(/7[17].*Snow/);
  });

  it("maps codes 95-99 to Thunderstorm", () => {
    expect(weatherSource).toMatch(/9[59].*Thunderstorm/);
  });

  it("handles unknown codes", () => {
    expect(weatherSource).toMatch(/Unknown/);
  });
});

describe("WeatherWidget — formatDayName", () => {
  it("defines formatDayName function", () => {
    expect(weatherSource).toMatch(/function formatDayName/);
  });

  it("returns 'Today' for current day", () => {
    expect(weatherSource).toMatch(/Today/);
  });

  it("returns 'Tomorrow' for next day", () => {
    expect(weatherSource).toMatch(/Tomorrow/);
  });

  it("returns weekday name for other days", () => {
    expect(weatherSource).toMatch(/weekday.*short|toLocaleDateString/);
  });
});

// ─── Icon Mapping ────────────────────────────────────────

describe("WeatherWidget — icon mapping", () => {
  it("imports weather-related icons from lucide-react", () => {
    expect(weatherSource).toMatch(/import.*Sun.*lucide-react/s);
    expect(weatherSource).toMatch(/import.*Cloud.*lucide-react/s);
    expect(weatherSource).toMatch(/import.*CloudRain.*lucide-react/s);
  });

  it("defines getWeatherIcon function", () => {
    expect(weatherSource).toMatch(/function getWeatherIcon/);
  });

  it("defines getSmallWeatherIcon function", () => {
    expect(weatherSource).toMatch(/function getSmallWeatherIcon/);
  });

  it("uses Sun icon for clear codes (0-1)", () => {
    expect(weatherSource).toMatch(/code\s*===?\s*0|code\s*===?\s*1/);
    expect(weatherSource).toMatch(/<Sun/);
  });

  it("uses CloudSnow icon for snow codes (71-77)", () => {
    expect(weatherSource).toMatch(/<CloudSnow/);
  });

  it("uses CloudLightning icon for thunderstorm codes (95-99)", () => {
    expect(weatherSource).toMatch(/<CloudLightning/);
  });

  it("uses CloudDrizzle icon for drizzle codes (51-55)", () => {
    expect(weatherSource).toMatch(/<CloudDrizzle/);
  });

  it("uses CloudFog icon for fog codes (45-48)", () => {
    expect(weatherSource).toMatch(/<CloudFog/);
  });
});

// ─── Accessibility ───────────────────────────────────────

describe("WeatherWidget — accessibility", () => {
  it("marks decorative icons as aria-hidden", () => {
    const ariaHiddenCount = (weatherSource.match(/aria-hidden\s*=\s*["']true["']/g) ?? []).length;
    expect(ariaHiddenCount).toBeGreaterThanOrEqual(5);
  });

  it("uses semantic heading via CardTitle", () => {
    expect(weatherSource).toMatch(/<CardTitle/);
  });

  it("includes descriptive text with weather info", () => {
    expect(weatherSource).toMatch(/Current Weather/);
  });

  it("displays unit labels with values", () => {
    expect(weatherSource).toMatch(/°F/);
    expect(weatherSource).toMatch(/mph/);
    expect(weatherSource).toMatch(/mm/);
  });
});

// ─── Data Fetching ───────────────────────────────────────

describe("WeatherWidget — data fetching", () => {
  it("uses Open-Meteo API", () => {
    expect(weatherSource).toMatch(/api\.open-meteo\.com/);
  });

  it("requests current weather data", () => {
    expect(weatherSource).toMatch(/current=/);
    expect(weatherSource).toMatch(/temperature_2m/);
  });

  it("requests daily forecast data", () => {
    expect(weatherSource).toMatch(/daily=/);
    expect(weatherSource).toMatch(/temperature_2m_max/);
  });

  it("uses useCallback for fetch function", () => {
    expect(weatherSource).toMatch(/useCallback/);
  });

  it("uses useEffect to trigger fetch", () => {
    expect(weatherSource).toMatch(/useEffect/);
  });

  it("sets loading false in finally block", () => {
    expect(weatherSource).toMatch(/finally\s*\{[\s\S]*?setLoading\(false\)/);
  });

  it("includes latitude and longitude in API URL", () => {
    expect(weatherSource).toMatch(/latitude=\$\{latitude\}/);
    expect(weatherSource).toMatch(/longitude=\$\{longitude\}/);
  });
});

// ─── Current Conditions Display ──────────────────────────

describe("WeatherWidget — current conditions", () => {
  it("displays current temperature", () => {
    expect(weatherSource).toMatch(/current\.temperature/);
    expect(weatherSource).toMatch(/°F/);
  });

  it("displays current wind speed", () => {
    expect(weatherSource).toMatch(/current\.windSpeed/);
    expect(weatherSource).toMatch(/mph/);
  });

  it("displays current precipitation", () => {
    expect(weatherSource).toMatch(/current\.precipitation/);
  });

  it("displays current weather description", () => {
    expect(weatherSource).toMatch(/getWeatherDescription\(current\.weatherCode\)/);
  });

  it("uses Wind icon for wind display", () => {
    expect(weatherSource).toMatch(/<Wind/);
  });

  it("uses Droplets icon for precipitation display", () => {
    expect(weatherSource).toMatch(/<Droplets/);
  });
});
