import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex items-center justify-center min-h-[80vh] p-4">
      <Card className="max-w-lg w-full text-center">
        <CardContent className="p-8 md:p-12 space-y-6">
          {/* Water-themed ASCII art */}
          <div className="text-5xl md:text-6xl leading-tight font-mono select-none" aria-hidden="true">
            <div>🏔️</div>
            <div className="text-3xl md:text-4xl mt-1">～～🚣～～</div>
            <div className="text-2xl mt-1 text-[var(--muted-foreground)]">
              ～～～～～～
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">404</h1>
            <h2 className="text-xl md:text-2xl font-semibold">Page Not Found</h2>
            <p className="text-[var(--muted-foreground)] text-sm md:text-base max-w-sm mx-auto">
              The river you&apos;re looking for seems to have dried up.
            </p>
          </div>

          <Link href="/">
            <Button size="lg">
              Back to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
