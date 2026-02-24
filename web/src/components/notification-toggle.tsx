"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff } from "lucide-react";

interface NotificationToggleProps {
  riverId: string;
  initialEnabled?: boolean;
}

export function NotificationToggle({
  riverId,
  initialEnabled = false,
}: NotificationToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    setEnabled(checked);

    if (checked && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEnabled(false);
        setLoading(false);
        return;
      }
    }

    // In a real app, this would call the API to update notification preferences
    // For now, just store the preference locally
    try {
      localStorage.setItem(`notify-${riverId}`, String(checked));
    } catch {
      // localStorage might not be available
    }

    setLoading(false);
  };

  return (
    <div className="flex items-center space-x-2">
      {enabled ? (
        <Bell className="h-4 w-4 text-[var(--primary)]" />
      ) : (
        <BellOff className="h-4 w-4 text-[var(--muted-foreground)]" />
      )}
      <Switch
        id={`notify-${riverId}`}
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={loading}
      />
      <Label htmlFor={`notify-${riverId}`} className="text-sm cursor-pointer">
        {enabled ? "Notifications on" : "Notify me"}
      </Label>
    </div>
  );
}
