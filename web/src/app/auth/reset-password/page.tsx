"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Waves, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const resetFormSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FieldErrors = Partial<Record<"newPassword" | "confirmPassword", string>>;

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-orange-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-yellow-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { toast } = useToast();

  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(form.newPassword);

  const updateField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  if (!token) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-[var(--destructive)]/10 p-3">
                <AlertCircle className="h-8 w-8 text-[var(--destructive)]" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Invalid Reset Link</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                This password reset link is invalid or has expired.
              </p>
            </div>
            <Link href="/auth/forgot-password">
              <Button variant="outline" className="mt-2">
                Request a New Link
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const parsed = resetFormSchema.safeParse(form);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, form.newPassword);
      toast({
        title: "Password reset successfully",
        description: "You can now sign in with your new password.",
        variant: "default",
      });
      router.push("/auth/signin");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      if (message.toLowerCase().includes("expired") || message.toLowerCase().includes("invalid")) {
        setError("This reset link is invalid or has expired.");
      } else {
        setError(message);
      }
      toast({
        title: "Reset failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Reset Password</CardTitle>
        <CardDescription>Enter your new password below</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p>{error}</p>
                {(error.includes("expired") || error.includes("invalid")) && (
                  <Link
                    href="/auth/forgot-password"
                    className="underline font-medium mt-1 inline-block"
                  >
                    Request a new reset link
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="••••••••"
              value={form.newPassword}
              onChange={updateField("newPassword")}
              required
              autoComplete="new-password"
              disabled={loading}
            />
            {fieldErrors.newPassword && (
              <p className="text-xs text-[var(--destructive)]">{fieldErrors.newPassword}</p>
            )}
            {/* Password Strength Indicator */}
            {form.newPassword.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i <= strength.score ? strength.color : "bg-[var(--muted)]"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--muted-foreground)]">{strength.label}</span>
                  <span className="text-[var(--muted-foreground)]">
                    {form.newPassword.length >= 8 ? "✓" : "✗"} 8+ chars
                    {" · "}
                    {/[A-Z]/.test(form.newPassword) ? "✓" : "✗"} uppercase
                    {" · "}
                    {/[0-9]/.test(form.newPassword) ? "✓" : "✗"} number
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={updateField("confirmPassword")}
              required
              autoComplete="new-password"
              disabled={loading}
            />
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-[var(--destructive)]">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Resetting…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Reset Password
              </span>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-[var(--muted-foreground)]">
          Remember your password?{" "}
          <Link
            href="/auth/signin"
            className="text-[var(--primary)] hover:underline font-medium"
          >
            Sign In
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function ResetPasswordPage() {
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
                  <span className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
                </div>
              </CardContent>
            </Card>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
