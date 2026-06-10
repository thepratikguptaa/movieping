import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { MediaType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Firestore doc id for a tracked title. Movies keep their bare numeric id
 *  (backward-compatible); series are namespaced to avoid id collisions. */
export function mediaDocId(mediaType: MediaType, id: number): string {
  return mediaType === "tv" ? `tv_${id}` : String(id);
}

export function formatDate(date?: string | null): string {
  if (!date) return "TBA";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** A movie is "released" if it has a release date that is today or earlier. */
export function isReleased(releaseDate?: string | null): boolean {
  if (!releaseDate) return false;
  const d = new Date(releaseDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
