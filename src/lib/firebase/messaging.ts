"use client";

import { getMessaging, getToken, onMessage, isSupported, type Messaging, type MessagePayload } from "firebase/messaging";
import { firebaseApp } from "./client";

let messagingInstance: Messaging | null = null;

export async function getMessagingClient(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  if (!(await isSupported())) return null;
  if (!messagingInstance) {
    messagingInstance = getMessaging(firebaseApp);
  }
  return messagingInstance;
}

/**
 * Request notification permission, register the SW, and return the FCM token.
 * Returns null if the user denies permission or the browser doesn't support FCM.
 */
export async function requestFcmToken(): Promise<string | null> {
  const messaging = await getMessagingClient();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js"
  );

  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  return token || null;
}

/** Subscribe to foreground messages (app is open & focused). */
export async function onForegroundMessage(
  cb: (payload: MessagePayload) => void
): Promise<() => void> {
  const messaging = await getMessagingClient();
  if (!messaging) return () => {};
  return onMessage(messaging, cb);
}
