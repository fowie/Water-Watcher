"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Waves, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [errorMessage, setErrorMessage] = useState(
    token ? "" : "No verification token provided"
  );

  const verifyEmail = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Verification failed");
      }
      setStatus("success");
      // Auto-redirect to sign-in after 3 seconds
      setTimeout(() => {
        router.push("/auth/signin");
      }, 3000);
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Invalid or expired verification link"
      );
    }
  }, [token, router]);

  useEffect(() => {
    verifyEmail();
  }, [verifyEmail]);

  return (
    <Card>
      <CardContent className="pt-8 pb-4">
        {status === "loading" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 text-[var(--primary)] animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Verifying your email…</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Please wait while we verify your email address.
              </p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-500/10 p-3">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Email Verified!</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Your email has been verified successfully. Redirecting to sign-in…
              </p>
            </div>
            <div className="flex justify-center">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-[var(--destructive)]/10 p-3">
                <AlertCircle className="h-12 w-12 text-[var(--destructive)]" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Verification Failed</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                {errorMessage || "Invalid or expired verification link"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-center pb-6">
        {status === "error" && (
          <Link href="/auth/signin">
            <Button variant="outline">Go to Sign In</Button>
          </Link>
        )}
        {status === "success" && (
          <Link
            href="/auth/signin"
            className="text-sm text-[var(--primary)] hover:underline font-medium"
          >
            Click here if you&apos;re not redirected
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Waves className="h-10 w-10 text-[var(--primary)]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Water-Watcher</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Track rivers. Score gear. Stay safe.
          </p>
        </div>

        <Suspense
          fallback={
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 text-[var(--primary)] animate-spin" />
                </div>
              </CardContent>
            </Card>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
