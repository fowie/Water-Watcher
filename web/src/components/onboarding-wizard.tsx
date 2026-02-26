"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Waves,
  Mountain,
  ShoppingBag,
  Compass,
  Search,
  Plus,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Loader2,
  Droplets,
  MapPin,
  Tag,
  DollarSign,
} from "lucide-react";
import { getRivers, trackRiver, createDealFilter } from "@/lib/api";
import type { RiverSummary } from "@/types";
import { toast } from "@/hooks/use-toast";

const ONBOARDING_KEY = "water-watcher-onboarding-complete";
const TOTAL_STEPS = 4;

interface OnboardingWizardProps {
  onComplete?: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { data: session, status } = useSession();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Step 2: River search state
  const [riverSearch, setRiverSearch] = useState("");
  const [riverResults, setRiverResults] = useState<RiverSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addedRivers, setAddedRivers] = useState<Set<string>>(new Set());

  // Step 3: Deal filter state
  const [dealCategory, setDealCategory] = useState("");
  const [dealMaxPrice, setDealMaxPrice] = useState("");
  const [dealKeywords, setDealKeywords] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      const completed = localStorage.getItem(ONBOARDING_KEY);
      if (!completed) {
        setVisible(true);
      }
    }
  }, [status]);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setVisible(false);
    onComplete?.();
  }, [onComplete]);

  const goToStep = useCallback(
    (nextStep: number) => {
      if (nextStep < 0 || nextStep >= TOTAL_STEPS) return;
      setTransitioning(true);
      setTimeout(() => {
        setStep(nextStep);
        setTransitioning(false);
      }, 200);
    },
    []
  );

  // River search with debounce
  useEffect(() => {
    if (!riverSearch.trim()) {
      setRiverResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await getRivers({ search: riverSearch, limit: 5 });
        setRiverResults(res.rivers);
      } catch {
        // Silent fail
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [riverSearch]);

  const handleAddRiver = async (river: RiverSummary) => {
    try {
      await trackRiver(river.id);
      setAddedRivers((prev) => new Set(prev).add(river.id));
      toast({
        title: "River added!",
        description: `${river.name} is now being tracked.`,
        variant: "success",
      });
    } catch {
      toast({
        title: "Couldn't add river",
        description: "You may need to try again later.",
        variant: "destructive",
      });
    }
  };

  const handleSaveDealFilter = async () => {
    if (!dealCategory && !dealKeywords) {
      goToStep(3);
      return;
    }
    try {
      const keywords = dealKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const userId = session?.user?.id ?? "demo-user";
      await createDealFilter(userId, {
        name: `${dealCategory || "General"} Deals`,
        keywords: keywords.length > 0 ? keywords : [dealCategory || "gear"],
        categories: dealCategory ? [dealCategory] : [],
        maxPrice: dealMaxPrice ? Number(dealMaxPrice) : undefined,
        regions: [],
        isActive: true,
      });
      toast({
        title: "Deal filter saved!",
        description: "You'll get notified when matching deals appear.",
        variant: "success",
      });
    } catch {
      // Non-blocking — user can still proceed
    }
    goToStep(3);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="max-w-lg w-full relative overflow-hidden">
        {/* Skip button */}
        <button
          onClick={completeOnboarding}
          className="absolute top-4 right-4 z-10 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Skip onboarding"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <CardContent className="p-6 md:p-8">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-8 bg-[var(--primary)]"
                    : i < step
                      ? "w-2 bg-[var(--primary)]/60"
                      : "w-2 bg-[var(--border)]"
                }`}
              />
            ))}
          </div>

          {/* Step content with transition */}
          <div
            className={`transition-all duration-200 ${
              transitioning
                ? "opacity-0 translate-y-2"
                : "opacity-100 translate-y-0"
            }`}
          >
            {step === 0 && <StepWelcome session={session} />}
            {step === 1 && (
              <StepAddRiver
                search={riverSearch}
                onSearchChange={setRiverSearch}
                results={riverResults}
                loading={searchLoading}
                addedRivers={addedRivers}
                onAdd={handleAddRiver}
              />
            )}
            {step === 2 && (
              <StepDealAlerts
                category={dealCategory}
                onCategoryChange={setDealCategory}
                maxPrice={dealMaxPrice}
                onMaxPriceChange={setDealMaxPrice}
                keywords={dealKeywords}
                onKeywordsChange={setDealKeywords}
              />
            )}
            {step === 3 && <StepDone onComplete={completeOnboarding} />}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]">
            <div>
              {step > 0 && step < 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goToStep(step - 1)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {step < 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={completeOnboarding}
                  className="text-[var(--muted-foreground)]"
                >
                  Skip
                </Button>
              )}
              {step === 0 && (
                <Button size="sm" onClick={() => goToStep(1)}>
                  Get Started
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
              {step === 1 && (
                <Button size="sm" onClick={() => goToStep(2)}>
                  {addedRivers.size > 0 ? "Next" : "Skip This Step"}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
              {step === 2 && (
                <Button size="sm" onClick={handleSaveDealFilter}>
                  {dealCategory || dealKeywords
                    ? "Save & Finish"
                    : "Skip This Step"}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepWelcome({
  session,
}: {
  session: ReturnType<typeof useSession>["data"];
}) {
  const name = session?.user?.name?.split(" ")[0] ?? "there";
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-4">
          <Waves className="h-10 w-10 text-[var(--primary)]" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Welcome, {name}!</h2>
        <p className="text-[var(--muted-foreground)] text-sm">
          Let&apos;s set up Water-Watcher so you can start tracking rivers and
          finding gear deals.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
        <FeatureCard
          icon={<Droplets className="h-5 w-5 text-blue-500" />}
          title="River Tracking"
          description="Monitor conditions, hazards, and flow rates in real time"
        />
        <FeatureCard
          icon={<ShoppingBag className="h-5 w-5 text-green-500" />}
          title="Gear Deals"
          description="Get alerts when rafting gear goes on sale"
        />
        <FeatureCard
          icon={<Compass className="h-5 w-5 text-orange-500" />}
          title="Trip Planning"
          description="Plan multi-day river trips with your crew"
        />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] p-3 space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}

function StepAddRiver({
  search,
  onSearchChange,
  results,
  loading,
  addedRivers,
  onAdd,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  results: RiverSummary[];
  loading: boolean;
  addedRivers: Set<string>;
  onAdd: (river: RiverSummary) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
            <Mountain className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold">Add Your First River</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Search for a river to start tracking its conditions.
        </p>
      </div>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]"
          aria-hidden="true"
        />
        <Input
          placeholder="Search rivers (e.g., Colorado, Salmon)..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {results.map((river) => {
            const isAdded = addedRivers.has(river.id);
            return (
              <div
                key={river.id}
                className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--border)] p-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin
                    className="h-4 w-4 text-[var(--muted-foreground)] shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{river.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {river.state}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isAdded ? "secondary" : "default"}
                  onClick={() => !isAdded && onAdd(river)}
                  disabled={isAdded}
                  className="shrink-0 ml-2"
                >
                  {isAdded ? (
                    <>
                      <Check className="h-3 w-3" aria-hidden="true" /> Added
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" aria-hidden="true" /> Add
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {!loading && search.trim() && results.length === 0 && (
        <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
          No rivers found for &ldquo;{search}&rdquo;
        </p>
      )}

      {addedRivers.size > 0 && (
        <p className="text-sm text-green-600 text-center">
          <Check className="inline h-4 w-4 mr-1" aria-hidden="true" />
          {addedRivers.size} river{addedRivers.size !== 1 ? "s" : ""} added!
        </p>
      )}
    </div>
  );
}

function StepDealAlerts({
  category,
  onCategoryChange,
  maxPrice,
  onMaxPriceChange,
  keywords,
  onKeywordsChange,
}: {
  category: string;
  onCategoryChange: (v: string) => void;
  maxPrice: string;
  onMaxPriceChange: (v: string) => void;
  keywords: string;
  onKeywordsChange: (v: string) => void;
}) {
  const categories = [
    "Kayaks",
    "Rafts",
    "Paddles",
    "PFDs",
    "Drysuits",
    "Helmets",
    "Accessories",
  ];

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="rounded-full bg-orange-100 dark:bg-orange-900/30 p-3">
            <Tag className="h-8 w-8 text-orange-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold">Set Up Deal Alerts</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Get notified when gear matching your preferences goes on sale.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Category</label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value="">Any category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat.toLowerCase()}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">
            <DollarSign
              className="inline h-3.5 w-3.5 mr-1"
              aria-hidden="true"
            />
            Max Price
          </label>
          <Input
            type="number"
            placeholder="e.g., 500"
            value={maxPrice}
            onChange={(e) => onMaxPriceChange(e.target.value)}
            min={0}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">
            Keywords (comma separated)
          </label>
          <Input
            placeholder='e.g., "NRS, Kokatat, dry suit"'
            value={keywords}
            onChange={(e) => onKeywordsChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function StepDone({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
          <Check className="h-10 w-10 text-green-600" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Water-Watcher is ready. Start exploring river conditions and gear
          deals.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/" onClick={onComplete}>
          <Button>
            <Waves className="h-4 w-4" aria-hidden="true" />
            Go to Dashboard
          </Button>
        </Link>
        <Link href="/rivers" onClick={onComplete}>
          <Button variant="outline">
            <Mountain className="h-4 w-4" aria-hidden="true" />
            Browse Rivers
          </Button>
        </Link>
        <Link href="/deals" onClick={onComplete}>
          <Button variant="outline">
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            View Deals
          </Button>
        </Link>
      </div>
    </div>
  );
}
