# Skill: Mock/Stub API Pattern

## When to Use
When you need a deterministic API endpoint that generates realistic data without external dependencies or API keys. Useful for weather, pricing, ratings, or any data that should look real but doesn't need to be live.

## Pattern

1. **Deterministic seed from inputs**: Use lat/lng, date, IDs, or other stable inputs as a seed for a pseudo-random number generator. `Math.sin(seed + offset) * 10000` gives reproducible 0-1 values.

2. **Domain-aware generation**: Layer real-world knowledge onto the random values. For weather: seasonal temperature curves, latitude effects, condition correlations (rainy → high humidity). For pricing: category-based ranges, regional adjustments.

3. **Response contract matches real API**: Shape the response identically to what a real API would return. This lets you swap in a real provider later without changing consumers.

4. **Cache headers**: Set appropriate `Cache-Control` since the data is deterministic within a time window. `max-age=1800` for weather (30 min), `stale-while-revalidate` for graceful updates.

## Example (Weather)
```typescript
function generateWeather(lat: number, lng: number, date: Date) {
  const dayOfYear = /* compute */;
  const seed = Math.abs(lat * 1000 + lng * 100 + dayOfYear);
  const rand = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };
  // Use rand(1), rand(2), etc. for each field
  // Apply domain constraints (temp ranges, correlations)
}
```

## Key Properties
- Same inputs → same output (testable without mocks)
- No API keys or network calls
- Realistic data distribution
- Swappable for real provider
