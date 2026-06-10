"use client";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./client";
import { mediaDocId } from "@/lib/utils";
import type {
  MediaType,
  UserProfile,
  UserPreferences,
  WatchlistItem,
  NotificationDoc,
} from "@/types";

const EMPTY_PREFS: UserPreferences = {
  genres: [],
  tvGenres: [],
  languages: [],
  industries: [],
  favoriteMovies: [],
};

// ---------------------------------------------------------------- user profile

export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL?: string
): Promise<UserProfile> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as UserProfile;

  const now = Date.now();
  const profile: UserProfile = {
    uid,
    email,
    displayName,
    photoURL,
    preferences: EMPTY_PREFS,
    onboarded: false,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, profile);
  return profile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function savePreferences(
  uid: string,
  preferences: UserPreferences
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    preferences,
    onboarded: true,
    updatedAt: Date.now(),
  });
}

export async function updateProfile(
  uid: string,
  data: Partial<Pick<UserProfile, "displayName" | "photoURL">>
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { ...data, updatedAt: Date.now() });
}

// ------------------------------------------------------------------ watchlist

export async function getWatchlist(uid: string): Promise<WatchlistItem[]> {
  const snap = await getDocs(collection(db, "users", uid, "watchlist"));
  return snap.docs.map((d) => d.data() as WatchlistItem);
}

export async function getWatchlistItem(
  uid: string,
  movieId: number,
  mediaType: MediaType = "movie"
): Promise<WatchlistItem | null> {
  const snap = await getDoc(
    doc(db, "users", uid, "watchlist", mediaDocId(mediaType, movieId))
  );
  return snap.exists() ? (snap.data() as WatchlistItem) : null;
}

export async function addToWatchlist(
  uid: string,
  item: Omit<WatchlistItem, "addedAt" | "notify">,
  notify = false
): Promise<void> {
  const mediaType = item.mediaType ?? "movie";
  await setDoc(doc(db, "users", uid, "watchlist", mediaDocId(mediaType, item.movieId)), {
    ...item,
    mediaType,
    notify,
    addedAt: Date.now(),
  });
}

export async function removeFromWatchlist(
  uid: string,
  movieId: number,
  mediaType: MediaType = "movie"
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "watchlist", mediaDocId(mediaType, movieId)));
}

// ----------------------------------------------------------- notification history

export async function getNotifications(uid: string): Promise<NotificationDoc[]> {
  const q = query(
    collection(db, "users", uid, "notifications"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NotificationDoc);
}

export async function markNotificationRead(uid: string, notifId: string): Promise<void> {
  await updateDoc(doc(db, "users", uid, "notifications", notifId), { read: true });
}

export { serverTimestamp };
