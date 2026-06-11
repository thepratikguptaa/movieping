"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { onForegroundMessage } from "@/lib/firebase/messaging";
import { ensurePushEnabled } from "@/lib/push";
import { useAuth } from "@/lib/auth-context";

type PermState = "default" | "granted" | "denied" | "unsupported";

/**
 * Manages FCM: notification permission, token registration (stored server-side),
 * and foreground message display. Auto-prompts once after login.
 */
export function useFcm() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PermState>("default");
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermState);
  }, []);

  // Display foreground notifications as toasts.
  useEffect(() => {
    if (!user) return;
    let unsub = () => {};
    onForegroundMessage((payload) => {
      const n = payload.notification;
      toast(n?.title ?? "MoviePing", {
        description: n?.body,
        action: payload.data?.url
          ? { label: "View", onClick: () => (window.location.href = payload.data!.url) }
          : undefined,
      });
    }).then((fn) => (unsub = fn));
    return () => unsub();
  }, [user]);

  const enableNotifications = useCallback(async () => {
    if (!user) return false;
    setRegistering(true);
    try {
      const ok = await ensurePushEnabled();
      setPermission(Notification.permission as PermState);
      if (ok) {
        toast.success("Notifications enabled", {
          description: "We'll ping you when your waitlisted movies release. Keep the permission set to “Allow” so alerts don't stop.",
        });
      }
      return ok;
    } catch (e) {
      toast.error("Could not enable notifications", {
        description: e instanceof Error ? e.message : String(e),
      });
      return false;
    } finally {
      setRegistering(false);
    }
  }, [user]);

  // Auto-prompt once per session if permission is still default.
  useEffect(() => {
    if (!user || permission !== "default") return;
    const key = `fcm-prompted-${user.uid}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void enableNotifications();
  }, [user, permission, enableNotifications]);

  return { permission, registering, enableNotifications };
}
