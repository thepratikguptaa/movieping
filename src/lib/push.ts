"use client";

import { toast } from "sonner";
import { requestFcmToken } from "@/lib/firebase/messaging";
import { apiFetch } from "@/lib/api-client";

/**
 * Ensure the browser has notification permission and a registered FCM token.
 * Shows guidance toasts (incl. the "set it to forever" nudge before the native
 * prompt). Returns true once a token is registered, false if denied/unsupported.
 *
 * Shared by the FCM bootstrap hook and the per-title "Notify" buttons so a user
 * who never enabled push gets prompted the moment they ask to be notified.
 */
export async function ensurePushEnabled(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;

  // If the browser is about to show its permission prompt, nudge the user to
  // grant it permanently — some browsers (e.g. Brave/Chrome) offer an "Allow
  // this time" option, and a temporary grant silently stops push later.
  if (Notification.permission === "default") {
    toast.info("When prompted, choose “Allow” — set it to always/forever", {
      description: "Picking “this time only” means alerts stop working after this visit.",
      duration: 8000,
    });
  }

  const token = await requestFcmToken();
  if (!token) {
    toast.error("Notifications not enabled", {
      description: "Permission was denied or your browser doesn't support push.",
    });
    return false;
  }

  await apiFetch("/api/fcm/register", {
    method: "POST",
    body: JSON.stringify({ token, userAgent: navigator.userAgent }),
  });
  return true;
}
