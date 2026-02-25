"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConditionBadge } from "@/components/condition-badge";
import { RapidRating } from "@/components/rapid-rating";
import { Skeleton } from "@/components/ui/skeleton";
import { getRivers } from "@/lib/api";
import { formatFlowRate } from "@/lib/utils";
import {
  Search,
  Locate,
  ChevronUp,
  ChevronDown,
  Mountain,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { RiverSummary, RiverQuality } from "@/types";
import type L from "leaflet";

function qualityToColor(quality: RiverQuality | null | undefined): string {
  switch (quality) {
    case "excellent":
    case "good":
      return "#22c55e"; // green
    case "fair":
      return "#eab308"; // yellow
    case "poor":
      return "#f97316"; // orange
    case "dangerous":
      return "#ef4444"; // red
    default:
      return "#9ca3af"; // gray
  }
}

function createMarkerIcon(color: string, leaflet: typeof L): L.DivIcon {
  return leaflet.divIcon({
    className: "",
    html: `<div style="
      width: 24px; height: 24px; border-radius: 50%;
      background: ${color}; border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const leafletRef = useRef<typeof L | null>(null);

  const [rivers, setRivers] = useState<RiverSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Load rivers
  const loadRivers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRivers({ limit: 500 });
      setRivers(data.rivers);
    } catch {
      // Silent fail — empty map
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRivers();
  }, [loadRivers]);

  // Rivers with coordinates
  const geoRivers = useMemo(
    () => rivers.filter((r) => {
      // RiverSummary doesn't have lat/lng, but the API may return them
      const river = r as RiverSummary & { latitude?: number | null; longitude?: number | null };
      return river.latitude != null && river.longitude != null;
    }),
    [rivers]
  );

  // Filtered rivers
  const filteredRivers = useMemo(() => {
    if (!search.trim()) return geoRivers;
    const q = search.toLowerCase();
    return geoRivers.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.state.toLowerCase().includes(q) ||
        (r.difficulty && r.difficulty.toLowerCase().includes(q))
    );
  }, [geoRivers, search]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    async function initMap() {
      const leaflet = (await import("leaflet")).default;

      // Fix default icon paths for Leaflet in bundled environments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (cancelled || !mapContainerRef.current) return;

      leafletRef.current = leaflet;
      const map = leaflet.map(mapContainerRef.current, {
        center: [39.8283, -98.5795], // Center of US
        zoom: 4,
        zoomControl: true,
      });

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        })
        .addTo(map);

      mapRef.current = map;
      setMapReady(true);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Add/update markers when rivers or filter changes
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current || !mapReady) return;
    const map = mapRef.current;
    const leaflet = leafletRef.current;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredRivers.forEach((r) => {
      const river = r as RiverSummary & { latitude?: number; longitude?: number };
      if (river.latitude == null || river.longitude == null) return;

      const quality = river.latestCondition?.quality ?? null;
      const color = qualityToColor(quality);
      const icon = createMarkerIcon(color, leaflet);

      const marker = leaflet
        .marker([river.latitude, river.longitude], { icon })
        .addTo(map);

      const flowText = river.latestCondition?.flowRate != null
        ? formatFlowRate(river.latestCondition.flowRate)
        : "No data";

      const qualityHtml = quality
        ? `<span style="
            display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;
            background:${color}20;color:${color};text-transform:capitalize;
          ">${quality}</span>`
        : '<span style="color:#9ca3af;font-size:12px;">Unknown</span>';

      const difficultyHtml = river.difficulty
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:500;background:#f3f4f6;color:#374151;">${river.difficulty}</span>`
        : "";

      marker.bindPopup(`
        <div style="min-width:180px;font-family:system-ui,sans-serif;">
          <h3 style="margin:0 0 4px;font-size:14px;font-weight:700;">${river.name}</h3>
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">${river.state}</p>
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
            ${qualityHtml}
            ${difficultyHtml}
          </div>
          <p style="margin:0 0 8px;font-size:12px;color:#374151;">Flow: <strong>${flowText}</strong></p>
          <a href="/rivers/${river.id}" style="
            display:inline-block;padding:4px 12px;border-radius:6px;
            background:#0ea5e9;color:white;font-size:12px;font-weight:500;
            text-decoration:none;
          ">View Details →</a>
        </div>
      `);

      markersRef.current.push(marker);
    });

    // Fit bounds if we have markers
    if (markersRef.current.length > 0) {
      const group = leaflet.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }, [filteredRivers, mapReady]);

  // Zoom to a river
  const zoomToRiver = useCallback((river: RiverSummary) => {
    const r = river as RiverSummary & { latitude?: number; longitude?: number };
    if (!mapRef.current || r.latitude == null || r.longitude == null) return;
    mapRef.current.setView([r.latitude, r.longitude], 12, { animate: true });

    // Open the popup
    const marker = markersRef.current.find((m) => {
      const pos = m.getLatLng();
      return Math.abs(pos.lat - r.latitude!) < 0.0001 && Math.abs(pos.lng - r.longitude!) < 0.0001;
    });
    if (marker) marker.openPopup();
  }, []);

  // Locate me
  const handleLocate = useCallback(() => {
    if (!mapRef.current || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 10, { animate: true });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return (
    <main className="relative h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden">
      {/* Leaflet CSS */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      {/* Map container */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* Search + Controls overlay */}
      <div className="absolute top-3 left-3 right-3 md:right-auto md:left-3 z-[1000] flex gap-2">
        <div className="relative flex-1 md:w-72 md:flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
          <Input
            type="text"
            placeholder="Search rivers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 bg-white dark:bg-[var(--background)] shadow-lg border-0"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleLocate}
          disabled={locating}
          className="bg-white dark:bg-[var(--background)] shadow-lg border-0 shrink-0"
          aria-label="Find my location"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Locate className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-20 md:bottom-4 right-3 z-[1000]">
        <Card className="shadow-lg">
          <CardContent className="p-3 space-y-1.5">
            <p className="text-xs font-semibold text-[var(--muted-foreground)]">Condition</p>
            {[
              { label: "Excellent/Good", color: "#22c55e" },
              { label: "Fair", color: "#eab308" },
              { label: "Poor", color: "#f97316" },
              { label: "Dangerous", color: "#ef4444" },
              { label: "Unknown", color: "#9ca3af" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-white"
                  style={{ background: color, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
                />
                {label}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block absolute top-0 right-0 bottom-0 z-[1000] w-80">
        <div className="h-full bg-[var(--background)]/95 backdrop-blur-sm border-l border-[var(--border)] flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Mountain className="h-4 w-4" aria-hidden="true" />
              Rivers
              <Badge variant="secondary" className="text-xs">
                {filteredRivers.length}
              </Badge>
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredRivers.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">
                {geoRivers.length === 0
                  ? "No rivers with coordinates found."
                  : "No rivers match your search."}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {filteredRivers.map((river) => (
                  <button
                    key={river.id}
                    onClick={() => zoomToRiver(river)}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--secondary)] transition-colors"
                  >
                    <p className="font-medium text-sm truncate">{river.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {river.state}
                      </span>
                      {river.latestCondition?.quality && (
                        <ConditionBadge quality={river.latestCondition.quality} />
                      )}
                      {river.difficulty && (
                        <RapidRating difficulty={river.difficulty} />
                      )}
                    </div>
                    {river.latestCondition?.flowRate != null && (
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        {formatFlowRate(river.latestCondition.flowRate)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <div className="md:hidden absolute bottom-16 left-0 right-0 z-[1000]">
        <div className="bg-[var(--background)]/95 backdrop-blur-sm border-t border-[var(--border)] rounded-t-xl shadow-lg">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center py-2"
            aria-label={sidebarOpen ? "Collapse river list" : "Expand river list"}
          >
            <div className="w-8 h-1 rounded-full bg-[var(--muted-foreground)]/30" />
          </button>
          <div className="px-4 pb-1 flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              Rivers
              <Badge variant="secondary" className="text-xs">
                {filteredRivers.length}
              </Badge>
            </h2>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle river list">
              {sidebarOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
          {sidebarOpen && (
            <div className="max-h-48 overflow-y-auto divide-y divide-[var(--border)]">
              {loading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredRivers.length === 0 ? (
                <p className="p-4 text-center text-sm text-[var(--muted-foreground)]">
                  No rivers found.
                </p>
              ) : (
                filteredRivers.map((river) => (
                  <button
                    key={river.id}
                    onClick={() => {
                      zoomToRiver(river);
                      setSidebarOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[var(--secondary)] transition-colors"
                  >
                    <p className="font-medium text-sm truncate">{river.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {river.state}
                      </span>
                      {river.latestCondition?.quality && (
                        <ConditionBadge quality={river.latestCondition.quality} />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
