"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlistItem,
} from "@/lib/firebase/db";
import { apiFetch } from "@/lib/api-client";
import { isReleased } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { WatchlistItem } from "@/types";

interface Props {
  movieId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
}

export function MovieActions({ movieId, title, posterPath, releaseDate }: Props) {
  const { user } = useAuth();
  const [item, setItem] = useState<WatchlistItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"watch" | "notify" | null>(null);
  const released = isReleased(releaseDate);

  useEffect(() => {
    if (!user) return;
    getWatchlistItem(user.uid, movieId)
      .then(setItem)
      .finally(() => setLoading(false));
  }, [user, movieId]);

  const inWatchlist = !!item;
  const notifying = !!item?.notify;

  async function toggleWatchlist() {
    if (!user) return;
    setBusy("watch");
    try {
      if (inWatchlist) {
        await removeFromWatchlist(user.uid, movieId);
        if (notifying) await apiFetch(`/api/waitlist?movieId=${movieId}`, { method: "DELETE" });
        setItem(null);
        toast("Removed from watchlist");
      } else {
        await addToWatchlist(user.uid, {
          movieId,
          title,
          posterPath,
          releaseDate,
          released,
        });
        setItem({
          movieId,
          title,
          posterPath,
          releaseDate,
          released,
          notify: false,
          addedAt: Date.now(),
        });
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
      // Ensure it's on the watchlist first.
      if (!inWatchlist) {
        await addToWatchlist(
          user.uid,
          { movieId, title, posterPath, releaseDate, released },
          true
        );
      }

      if (notifying) {
        await apiFetch(`/api/waitlist?movieId=${movieId}`, { method: "DELETE" });
        await addToWatchlist(
          user.uid,
          { movieId, title, posterPath, releaseDate, released },
          false
        );
        setItem((p) => (p ? { ...p, notify: false } : p));
        toast("Release alerts off");
      } else {
        await apiFetch("/api/waitlist", {
          method: "POST",
          body: JSON.stringify({ movieId, title, posterPath, releaseDate }),
        });
        await addToWatchlist(
          user.uid,
          { movieId, title, posterPath, releaseDate, released },
          true
        );
        setItem({
          movieId,
          title,
          posterPath,
          releaseDate,
          released,
          notify: true,
          addedAt: item?.addedAt ?? Date.now(),
        });
        toast.success(
          released ? "Added to waitlist" : "We'll ping you when it releases 🔔"
        );
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

      <Button onClick={toggleNotify} disabled={busy !== null} variant={notifying ? "secondary" : "outline"}>
        {busy === "notify" ? (
          <Loader2 className="animate-spin" />
        ) : notifying ? (
          <BellOff />
        ) : (
          <Bell />
        )}
        {notifying ? "Alerts on" : released ? "Notify (waitlist)" : "Notify me when released"}
      </Button>
    </div>
  );
}
