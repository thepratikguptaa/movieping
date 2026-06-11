"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Bookmark, BookmarkCheck, Loader2, Tv } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlistItem,
} from "@/lib/firebase/db";
import { apiFetch } from "@/lib/api-client";
import { ensurePushEnabled } from "@/lib/push";
import { isReleased } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { MediaType, WatchlistItem } from "@/types";

interface Props {
  movieId: number;
  mediaType?: MediaType;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  /** Already available on OTT in some region. For movies this disables the
   *  notify toggle (nothing left to alert on); for series it does NOT, because
   *  new-season alerts remain useful while streaming. */
  streaming?: boolean;
}

export function MovieActions({
  movieId,
  mediaType = "movie",
  title,
  posterPath,
  releaseDate,
  streaming = false,
}: Props) {
  const { user } = useAuth();
  const [item, setItem] = useState<WatchlistItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"watch" | "notify" | null>(null);
  const isTv = mediaType === "tv";
  // Series are driven by the OTT checker, so treat them as "released" for the
  // purposes of subscription messaging.
  const released = isTv ? true : isReleased(releaseDate);
  const base = { movieId, mediaType, title, posterPath, releaseDate, released };

  useEffect(() => {
    if (!user) return;
    getWatchlistItem(user.uid, movieId, mediaType)
      .then(setItem)
      .finally(() => setLoading(false));
  }, [user, movieId, mediaType]);

  const inWatchlist = !!item;
  const notifying = !!item?.notify;
  const delQuery = `movieId=${movieId}&mediaType=${mediaType}`;

  async function toggleWatchlist() {
    if (!user) return;
    setBusy("watch");
    try {
      if (inWatchlist) {
        await removeFromWatchlist(user.uid, movieId, mediaType);
        if (notifying) await apiFetch(`/api/waitlist?${delQuery}`, { method: "DELETE" });
        setItem(null);
        toast("Removed from watchlist");
      } else {
        await addToWatchlist(user.uid, base);
        setItem({ ...base, notify: false, addedAt: Date.now() });
        toast.success("Added to watchlist");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function toggleNotify() {
    if (!user) return;
    setBusy("notify");
    try {
      // Turning alerts ON: make sure browser push is actually enabled first —
      // otherwise the user subscribes but never receives a notification.
      if (!notifying && typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission !== "granted") await ensurePushEnabled();
      }

      // Ensure it's on the watchlist first.
      if (!inWatchlist) {
        await addToWatchlist(user.uid, base, true);
      }

      if (notifying) {
        await apiFetch(`/api/waitlist?${delQuery}`, { method: "DELETE" });
        await addToWatchlist(user.uid, base, false);
        setItem((p) => (p ? { ...p, notify: false } : p));
        toast(isTv ? "Series alerts off" : "Release alerts off");
      } else {
        const res = await apiFetch<{
          alreadyStreaming?: boolean;
          providers?: string[];
        }>("/api/waitlist", {
          method: "POST",
          body: JSON.stringify({ movieId, mediaType, title, posterPath, releaseDate }),
        });
        await addToWatchlist(user.uid, base, true);
        setItem({ ...base, notify: true, addedAt: item?.addedAt ?? Date.now() });

        if (isTv) {
          toast.success(
            res?.alreadyStreaming
              ? "Streaming now — we'll ping you when new seasons drop 📺"
              : "We'll ping you when it streams & when new seasons drop 📺"
          );
        } else if (res?.alreadyStreaming) {
          const on = res.providers?.length ? ` on ${res.providers[0]}` : "";
          toast.success(`Already streaming${on} — added to your watchlist 📺`);
        } else {
          toast.success(
            released
              ? "We'll ping you when it starts streaming 📺"
              : "We'll ping you when it releases & hits streaming 🔔"
          );
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <Button disabled variant="secondary">
        <Loader2 className="animate-spin" /> Loading
      </Button>
    );
  }

  // For movies already on OTT there's no future event to alert on. Series keep
  // the toggle so the user still gets new-season pings.
  const showStreamingNow = streaming && !isTv;

  const notifyLabel = notifying
    ? "Alerts on"
    : isTv
      ? "Notify (streaming & new seasons)"
      : released
        ? "Notify (waitlist)"
        : "Notify me when released";

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={toggleWatchlist} disabled={busy !== null} variant={inWatchlist ? "secondary" : "default"}>
        {busy === "watch" ? (
          <Loader2 className="animate-spin" />
        ) : inWatchlist ? (
          <BookmarkCheck />
        ) : (
          <Bookmark />
        )}
        {inWatchlist ? "In Watchlist" : "Add to Watchlist"}
      </Button>

      {showStreamingNow ? (
        <Button disabled variant="secondary">
          <Tv /> Streaming now
        </Button>
      ) : (
        <Button onClick={toggleNotify} disabled={busy !== null} variant={notifying ? "secondary" : "outline"}>
          {busy === "notify" ? (
            <Loader2 className="animate-spin" />
          ) : notifying ? (
            <BellOff />
          ) : (
            <Bell />
          )}
          {notifyLabel}
        </Button>
      )}
    </div>
  );
}
