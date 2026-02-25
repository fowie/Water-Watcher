"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConditionBadge } from "@/components/condition-badge";
import { HazardBadge } from "@/components/hazard-badge";
import { RapidRating } from "@/components/rapid-rating";
import { NotificationToggle } from "@/components/notification-toggle";
import { EditRiverDialog } from "@/components/edit-river-dialog";
import { MapLink } from "@/components/map-link";
import { Button } from "@/components/ui/button";
import { FlowTrend } from "@/components/flow-trend";
import { WeatherWidget } from "@/components/weather-widget";
import { getRiver } from "@/lib/api";
import { formatFlowRate, timeAgo } from "@/lib/utils";
import {
  ArrowLeft,
  Droplets,
  Thermometer,
  Ruler,
  AlertTriangle,
  Tent,
  Waves,
  MapPin,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  CloudSun,
} from "lucide-react";
import Link from "next/link";
import type { RiverDetail, ConditionRecord, HazardRecord, CampsiteRecord, RapidRecord } from "@/types";

export default function RiverDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [river, setRiver] = useState<RiverDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRiver = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRiver(id);
      setRiver(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load river");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRiver();
  }, [loadRiver]);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </main>
    );
  }

  if (error || !river) {
    return (
      <main className="p-4 md:p-8 max-w-4xl mx-auto text-center py-20 space-y-4">
        <p className="text-[var(--destructive)] font-medium">
          {error ?? "River not found"}
        </p>
        <Link href="/rivers">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" /> Back to Rivers
          </Button>
        </Link>
      </main>
    );
  }

  const latestCondition = river.conditions?.[0] ?? null;

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb & Header */}
      <div className="space-y-4">
        <Link
          href="/rivers"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Rivers
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold">{river.name}</h1>
            <p className="text-[var(--muted-foreground)]">
              {river.state}
              {river.region && ` • ${river.region}`}
              {river.difficulty && (
                <span className="ml-2">
                  <RapidRating difficulty={river.difficulty} />
                </span>
              )}
            </p>
            {river.description && (
              <p className="text-sm text-[var(--muted-foreground)] mt-2 max-w-2xl">
                {river.description}
              </p>
            )}
            {river.latitude != null && river.longitude != null && (
              <div className="mt-1">
                <MapLink
                  latitude={river.latitude}
                  longitude={river.longitude}
                  label={river.name}
                  showLabel
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <EditRiverDialog river={river} onRiverUpdated={loadRiver} />
            <NotificationToggle riverId={river.id} />
          </div>
        </div>
      </div>

      {/* Quick stats */}
      {latestCondition && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Droplets className="h-4 w-4" />}
            label="Flow Rate"
            value={formatFlowRate(latestCondition.flowRate)}
            extra={
              <FlowTrend conditions={river.conditions ?? []} />
            }
          />
          <StatCard
            icon={<Ruler className="h-4 w-4" />}
            label="Gauge Height"
            value={
              latestCondition.gaugeHeight != null
                ? `${latestCondition.gaugeHeight.toFixed(2)} ft`
                : "N/A"
            }
          />
          <StatCard
            icon={<Thermometer className="h-4 w-4" />}
            label="Water Temp"
            value={
              latestCondition.waterTemp != null
                ? `${latestCondition.waterTemp.toFixed(0)}°F`
                : "N/A"
            }
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Active Hazards"
            value={String(river.hazards?.filter((h) => h.isActive).length ?? 0)}
          />
        </div>
      )}

      {/* Tabbed content */}
      <Tabs defaultValue="conditions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="conditions">
            <Droplets className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            Conditions
          </TabsTrigger>
          <TabsTrigger value="weather">
            <CloudSun className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            Weather
          </TabsTrigger>
          <TabsTrigger value="hazards">
            <AlertTriangle className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            Hazards
          </TabsTrigger>
          <TabsTrigger value="rapids">
            <Waves className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            Rapids
          </TabsTrigger>
          <TabsTrigger value="campsites">
            <Tent className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            Campsites
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conditions">
          <ConditionsTab conditions={river.conditions ?? []} />
        </TabsContent>
        <TabsContent value="weather">
          <WeatherWidget latitude={river.latitude} longitude={river.longitude} />
        </TabsContent>
        <TabsContent value="hazards">
          <HazardsTab hazards={river.hazards ?? []} />
        </TabsContent>
        <TabsContent value="rapids">
          <RapidsTab rapids={river.rapids ?? []} />
        </TabsContent>
        <TabsContent value="campsites">
          <CampsitesTab campsites={river.campsites ?? []} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

/* ─── Stat Card ────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  extra?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-1">
        <span className="text-xs text-[var(--muted-foreground)] flex items-center gap-1.5">
          {icon} {label}
        </span>
        <span className="text-lg font-bold flex items-center gap-1.5">
          {value}
          {extra}
        </span>
      </CardContent>
    </Card>
  );
}

/* ─── Conditions Tab ──────────────────────────────────── */

function ConditionsTab({ conditions }: { conditions: ConditionRecord[] }) {
  if (conditions.length === 0) {
    return (
      <EmptyTab
        icon={<Droplets className="h-8 w-8" />}
        message="No condition data yet. The scraping pipeline will populate this automatically."
      />
    );
  }

  return (
    <div className="space-y-3">
      {conditions.map((cond) => (
        <Card key={cond.id}>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                {cond.quality && <ConditionBadge quality={cond.quality} />}
                {cond.runnability && (
                  <Badge variant="secondary" className="capitalize">
                    {cond.runnability.replace("_", " ")}
                  </Badge>
                )}
                <Badge variant="outline">{cond.source.toUpperCase()}</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
                {cond.flowRate != null && (
                  <span className="flex items-center gap-1">
                    <Droplets className="h-3.5 w-3.5" />
                    {formatFlowRate(cond.flowRate)}
                  </span>
                )}
                {cond.gaugeHeight != null && (
                  <span className="flex items-center gap-1">
                    <Ruler className="h-3.5 w-3.5" />
                    {cond.gaugeHeight.toFixed(2)} ft
                  </span>
                )}
                {cond.waterTemp != null && (
                  <span className="flex items-center gap-1">
                    <Thermometer className="h-3.5 w-3.5" />
                    {cond.waterTemp.toFixed(0)}°F
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(cond.scrapedAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Hazards Tab ─────────────────────────────────────── */

function HazardsTab({ hazards }: { hazards: HazardRecord[] }) {
  if (hazards.length === 0) {
    return (
      <EmptyTab
        icon={<AlertTriangle className="h-8 w-8" />}
        message="No active hazards reported. Stay safe out there!"
      />
    );
  }

  return (
    <div className="space-y-3">
      {hazards.map((hazard) => (
        <Card
          key={hazard.id}
          className={
            hazard.severity === "danger"
              ? "border-red-300 dark:border-red-900"
              : hazard.severity === "warning"
              ? "border-yellow-300 dark:border-yellow-900"
              : ""
          }
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">{hazard.title}</CardTitle>
              <HazardBadge severity={hazard.severity} type={hazard.type} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {hazard.description && (
              <p className="text-sm text-[var(--muted-foreground)]">
                {hazard.description}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Reported {timeAgo(hazard.reportedAt)}
              </span>
              <span className="flex items-center gap-1">
                Source: {hazard.source}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Rapids Tab ──────────────────────────────────────── */

function RapidsTab({ rapids }: { rapids: RapidRecord[] }) {
  if (rapids.length === 0) {
    return (
      <EmptyTab
        icon={<Waves className="h-8 w-8" />}
        message="No rapids cataloged for this river yet."
      />
    );
  }

  return (
    <div className="space-y-3">
      {rapids.map((rapid) => (
        <Card key={rapid.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{rapid.name}</h3>
                  <RapidRating difficulty={rapid.difficulty} />
                </div>
                {rapid.mile != null && (
                  <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Mile {rapid.mile.toFixed(1)}
                  </p>
                )}
                {rapid.description && (
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                    {rapid.description}
                  </p>
                )}
                {rapid.runGuide && (
                  <div className="mt-2 p-3 bg-[var(--muted)] rounded-md">
                    <p className="text-xs font-medium mb-1">Run Guide</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {rapid.runGuide}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Campsites Tab ───────────────────────────────────── */

function CampsitesTab({ campsites }: { campsites: CampsiteRecord[] }) {
  if (campsites.length === 0) {
    return (
      <EmptyTab
        icon={<Tent className="h-8 w-8" />}
        message="No campsites listed for this river yet."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {campsites.map((camp) => (
        <Card key={camp.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Tent className="h-4 w-4 text-[var(--primary)]" />
              {camp.name}
              {camp.latitude != null && camp.longitude != null && (
                <MapLink
                  latitude={camp.latitude}
                  longitude={camp.longitude}
                  label={camp.name}
                />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {camp.type && (
              <Badge variant="secondary" className="uppercase text-xs">
                {camp.type}
              </Badge>
            )}
            {camp.description && (
              <p className="text-sm text-[var(--muted-foreground)]">
                {camp.description}
              </p>
            )}
            {camp.amenities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {camp.amenities.map((a) => (
                  <Badge key={a} variant="outline" className="text-xs capitalize">
                    {a.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
              {camp.permitRequired && (
                <span className="flex items-center gap-1 text-orange-600">
                  <XCircle className="h-3 w-3" />
                  Permit required
                </span>
              )}
              {!camp.permitRequired && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  No permit needed
                </span>
              )}
              {camp.latitude != null && camp.longitude != null && (
                <MapLink
                  latitude={camp.latitude}
                  longitude={camp.longitude}
                  label={camp.name}
                  showLabel
                />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Empty Tab ───────────────────────────────────────── */

function EmptyTab({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="text-center py-16 space-y-3">
      <div className="flex justify-center">
        <div className="rounded-full bg-[var(--muted)] p-3 text-[var(--muted-foreground)]">
          {icon}
        </div>
      </div>
      <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
    </div>
  );
}
