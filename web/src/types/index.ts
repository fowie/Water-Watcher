// Shared TypeScript types for Water-Watcher

export type RiverQuality = "excellent" | "good" | "fair" | "poor" | "dangerous";
export type Runnability = "optimal" | "runnable" | "too_low" | "too_high";
export type HazardSeverity = "info" | "warning" | "danger";
export type HazardType =
  | "strainer"
  | "dam"
  | "logjam"
  | "rapid_change"
  | "closure"
  | "permit_required";
export type GearCategory =
  | "raft"
  | "kayak"
  | "paddle"
  | "pfd"
  | "drysuit"
  | "other";
export type DataSource = "usgs" | "aw" | "facebook" | "blm" | "usfs" | "craigslist";

export interface RiverSummary {
  id: string;
  name: string;
  state: string;
  difficulty: string | null;
  latestCondition: {
    quality: RiverQuality | null;
    flowRate: number | null;
    runnability: Runnability | null;
    scrapedAt: string;
  } | null;
  activeHazardCount: number;
  trackerCount: number;
}

export interface RiverDetail {
  id: string;
  name: string;
  state: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  difficulty: string | null;
  description: string | null;
  conditions: ConditionRecord[];
  hazards: HazardRecord[];
  campsites: CampsiteRecord[];
  rapids: RapidRecord[];
}

export interface ConditionRecord {
  id: string;
  flowRate: number | null;
  gaugeHeight: number | null;
  waterTemp: number | null;
  quality: RiverQuality | null;
  runnability: Runnability | null;
  source: DataSource;
  scrapedAt: string;
}

export interface HazardRecord {
  id: string;
  type: HazardType;
  severity: HazardSeverity;
  title: string;
  description: string | null;
  source: string;
  reportedAt: string;
  isActive: boolean;
}

export interface CampsiteRecord {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  type: string | null;
  amenities: string[];
  permitRequired: boolean;
  description: string | null;
}

export interface RapidRecord {
  id: string;
  name: string;
  difficulty: string | null;
  mile: number | null;
  description: string | null;
  runGuide: string | null;
}

export interface GearDealRecord {
  id: string;
  title: string;
  price: number | null;
  url: string;
  imageUrl: string | null;
  description: string | null;
  category: GearCategory | null;
  region: string | null;
  postedAt: string | null;
  scrapedAt: string;
}

export interface DealFilterRecord {
  id: string;
  name: string;
  keywords: string[];
  categories: GearCategory[];
  maxPrice: number | null;
  regions: string[];
  isActive: boolean;
  matchCount: number;
}
