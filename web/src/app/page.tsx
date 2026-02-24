import Link from "next/link";
import { Mountain, ShoppingBag, Waves, Bell, TrendingUp, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-[calc(100vh-3.5rem)] md:min-h-screen">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-blue-50 dark:bg-blue-950 p-4">
              <Waves className="h-12 w-12 text-[var(--primary)]" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Water-Watcher
          </h1>
          <p className="text-lg md:text-xl text-[var(--muted-foreground)] max-w-xl mx-auto">
            Track whitewater rafting conditions, find the best runs, and score
            gear deals — all in one place.
          </p>
          <div className="flex gap-3 justify-center flex-wrap pt-2">
            <Link
              href="/rivers"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium hover:opacity-90 transition text-sm md:text-base"
            >
              <Mountain className="h-5 w-5" />
              Explore Rivers
            </Link>
            <Link
              href="/deals"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--secondary)] text-[var(--secondary-foreground)] rounded-lg font-medium hover:opacity-90 transition text-sm md:text-base"
            >
              <ShoppingBag className="h-5 w-5" />
              Raft Watch Deals
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[var(--border)] bg-[var(--muted)]">
        <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<TrendingUp className="h-6 w-6" />}
              title="Live Conditions"
              description="Real-time flow rates, gauge heights, and water quality from USGS and American Whitewater."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Hazard Alerts"
              description="Stay safe with up-to-date hazard reports — strainers, log jams, closures, and more."
            />
            <FeatureCard
              icon={<Bell className="h-6 w-6" />}
              title="Deal Notifications"
              description="Set up filters and get notified when matching gear deals pop up on Craigslist."
            />
          </div>
        </div>
      </section>
    </main>
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
    <div className="flex flex-col items-center text-center space-y-3 p-4">
      <div className="rounded-lg bg-[var(--background)] p-3 shadow-sm border border-[var(--border)] text-[var(--primary)]">
        {icon}
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}
