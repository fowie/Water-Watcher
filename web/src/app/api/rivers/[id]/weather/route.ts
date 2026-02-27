import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";

/**
 * Mock weather service that generates deterministic, realistic weather data
 * based on latitude, longitude, and current date. No external API key needed.
 */
function generateWeather(lat: number, lng: number, date: Date) {
  // Use lat/lng + date to generate deterministic but realistic data
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const seed = Math.abs(lat * 1000 + lng * 100 + dayOfYear);

  // Pseudo-random from seed (deterministic)
  const rand = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x); // 0-1
  };

  // Base temperature from latitude and season (Northern Hemisphere bias for US rivers)
  const seasonalOffset = Math.cos(((dayOfYear - 172) / 365) * 2 * Math.PI) * 25;
  const latitudeEffect = (45 - Math.abs(lat)) * 0.8;
  const elevationProxy = Math.abs(lng + 110) * 0.3; // rough west-US elevation proxy
  const baseTemp = 60 + seasonalOffset + latitudeEffect - elevationProxy;
  const temperature = Math.round(
    Math.max(10, Math.min(105, baseTemp + (rand(1) - 0.5) * 15))
  );

  // Conditions based on temperature and randomness
  const conditionRoll = rand(2);
  let conditions: string;
  if (temperature < 32) {
    conditions = conditionRoll < 0.4 ? "snowy" : conditionRoll < 0.7 ? "cloudy" : "sunny";
  } else if (temperature < 50) {
    conditions = conditionRoll < 0.3 ? "rainy" : conditionRoll < 0.6 ? "cloudy" : "sunny";
  } else {
    conditions = conditionRoll < 0.2 ? "rainy" : conditionRoll < 0.45 ? "cloudy" : "sunny";
  }

  const windSpeed = Math.round(rand(3) * 25 + 2); // 2-27 mph
  const humidity = Math.round(
    conditions === "rainy" ? 70 + rand(4) * 25 :
    conditions === "snowy" ? 60 + rand(4) * 30 :
    conditions === "cloudy" ? 40 + rand(4) * 35 :
    20 + rand(4) * 40
  );
  const precipitationChance = Math.round(
    conditions === "rainy" ? 60 + rand(5) * 35 :
    conditions === "snowy" ? 50 + rand(5) * 40 :
    conditions === "cloudy" ? 15 + rand(5) * 30 :
    rand(5) * 15
  );

  // 5-day forecast
  const forecast = Array.from({ length: 5 }, (_, i) => {
    const forecastDate = new Date(date);
    forecastDate.setDate(forecastDate.getDate() + i + 1);
    const fDayOfYear = dayOfYear + i + 1;
    const fSeed = Math.abs(lat * 1000 + lng * 100 + fDayOfYear);
    const fRand = (offset: number) => {
      const x = Math.sin(fSeed + offset) * 10000;
      return x - Math.floor(x);
    };

    const fSeasonalOffset = Math.cos(((fDayOfYear - 172) / 365) * 2 * Math.PI) * 25;
    const fBaseTemp = 60 + fSeasonalOffset + latitudeEffect - elevationProxy;
    const fHigh = Math.round(Math.max(10, Math.min(110, fBaseTemp + fRand(1) * 10)));
    const fLow = Math.round(Math.max(5, fHigh - 15 - fRand(6) * 10));

    const fCondRoll = fRand(2);
    let fConditions: string;
    if (fHigh < 32) {
      fConditions = fCondRoll < 0.4 ? "snowy" : fCondRoll < 0.7 ? "cloudy" : "sunny";
    } else if (fHigh < 50) {
      fConditions = fCondRoll < 0.3 ? "rainy" : fCondRoll < 0.6 ? "cloudy" : "sunny";
    } else {
      fConditions = fCondRoll < 0.2 ? "rainy" : fCondRoll < 0.45 ? "cloudy" : "sunny";
    }

    return {
      date: forecastDate.toISOString().split("T")[0],
      high: fHigh,
      low: fLow,
      conditions: fConditions,
      precipitationChance: Math.round(
        fConditions === "rainy" ? 60 + fRand(5) * 35 :
        fConditions === "snowy" ? 50 + fRand(5) * 40 :
        fConditions === "cloudy" ? 15 + fRand(5) * 30 :
        fRand(5) * 15
      ),
    };
  });

  return {
    temperature,
    conditions,
    windSpeed,
    humidity,
    precipitation: Math.round(precipitationChance * 0.3 * 10) / 10, // estimated mm
    precipitationChance,
    forecast,
    generatedAt: date.toISOString(),
  };
}

export async function GET(
  _request: Request,
  context?: unknown
) {
  try {
    const { id } = await (context as { params: Promise<{ id: string }> }).params;

    const river = await prisma.river.findUnique({
      where: { id },
      select: { id: true, name: true, latitude: true, longitude: true },
    });

    if (!river) {
      return apiError(404, "River not found");
    }

    if (river.latitude === null || river.longitude === null) {
      return apiError(400, "River does not have location coordinates");
    }

    const weather = generateWeather(river.latitude, river.longitude, new Date());

    return NextResponse.json(
      {
        riverId: river.id,
        riverName: river.name,
        latitude: river.latitude,
        longitude: river.longitude,
        ...weather,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=1800, stale-while-revalidate=900",
        },
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
