"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/auth-guard";
import { getUserProfile, updateUserProfile } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { timeAgo } from "@/lib/utils";
import {
  User,
  Mail,
  Calendar,
  Mountain,
  Filter,
  Pencil,
  Check,
  X,
} from "lucide-react";
import type { UserProfile } from "@/lib/api";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}

function ProfileContent() {
  const { data: session, update: updateSession } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUserProfile();
      setProfile(data);
    } catch {
      toast({
        title: "Failed to load profile",
        description: "Could not fetch your profile data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const startEditing = () => {
    if (!profile) return;
    setEditName(profile.name || "");
    setEditEmail(profile.email || "");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const changes: { name?: string; email?: string } = {};
      if (editName !== (profile.name || "")) changes.name = editName;
      if (editEmail !== (profile.email || "")) changes.email = editEmail;

      if (Object.keys(changes).length === 0) {
        setEditing(false);
        return;
      }

      const updated = await updateUserProfile(changes);
      setProfile(updated);
      setEditing(false);
      // Refresh the session so the nav shows updated name
      await updateSession();
      toast({
        title: "Profile updated",
        description: "Your profile has been saved.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Could not save profile.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-64 w-full mt-4" />
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="p-4 md:p-8 max-w-3xl mx-auto">
        <p className="text-[var(--muted-foreground)]">Could not load profile.</p>
      </main>
    );
  }

  const initials = getInitials(profile.name);

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <User className="h-7 w-7 text-[var(--primary)]" aria-hidden="true" />
          Profile
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          View and manage your account
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="h-16 w-16 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center text-xl font-bold shrink-0">
                {session?.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div>
                <CardTitle className="text-xl">
                  {profile.name || "User"}
                </CardTitle>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {profile.email}
                </p>
              </div>
            </div>
            {!editing && (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            /* Edit form */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveProfile} disabled={saving} size="sm">
                  <Check className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* Read-only info */
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
                <span>{profile.email || "No email set"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <span>Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Account Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Mountain className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold">{profile.riverCount}</p>
                <p className="text-sm text-[var(--muted-foreground)]">Rivers Tracked</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Filter className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold">{profile.filterCount}</p>
                <p className="text-sm text-[var(--muted-foreground)]">Deal Filters Active</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Member Since */}
      <div className="text-center text-sm text-[var(--muted-foreground)]">
        <Badge variant="secondary" className="text-xs">
          Member for {timeAgo(profile.createdAt)}
        </Badge>
      </div>
    </main>
  );
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
