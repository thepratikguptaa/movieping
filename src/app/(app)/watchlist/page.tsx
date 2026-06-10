"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getWatchlist, removeFromWatchlist } from "@/lib/firebase/db";
import { apiFetch } from "@/lib/api-client";
import { posterUrl } from "@/lib/tmdb";
import { formatDate, isReleased } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { WatchlistItem } from "@/types";

function Item({ item, onRemove }: { item: WatchlistItem; onRemove: (id: number) => void }) {
  const img = posterUrl(item.posterPath, "w185");
  const released = item.released || isReleased(item.releaseDate);
  return (
    <div className="flex gap-4 rounded-lg border border-border bg-card p-3">
      <Link href={`/movie/${item.movieId}`} className="relative h-28 w-20 shrink-0 overflow-hidden rounded bg-secondary">
        {img && <Image src={img} alt={item.title} fill className="object-cover" />}
      </Link>
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <Link href={`/movie/${item.movieId}`} className="font-semibold hover:underline">
            {item.title}
          </Link>
          <p className="text-sm text-muted-foreground">{formatDate(item.releaseDate)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {released ? <Badge variant="success">Released</Badge> : <Badge>Upcoming</Badge>}
            {item.notify && (
              <Badge variant="secondary" className="gap-1">
                <Bell className="h-3 w-3" /> Alerts on
              </Badge>
            )}
          </div>
        </div>
        <div>
          <Button variant="ghost" size="sm" onClick={() => onRemove(item.movieId)}>
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function WatchlistPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<WatchlistItem[] | null>(null);

  useEffect(() => {
    if (!user) return;
    getWatchlist(user.uid)
      .then((list) => setItems(list.sort((a, b) => b.addedAt - a.addedAt)))
      .catch(() => setItems([]));
  }, [user]);

  async function remove(movieId: number) {
    if (!user) return;
    const prev = items ?? [];
    setItems(prev.filter((i) => i.movieId !== movieId));
    try {
      await removeFromWatchlist(user.uid, movieId);
      await apiFetch(`/api/waitlist?movieId=${movieId}`, { method: "DELETE" }).catch(() => {});
      toast("Removed from watchlist");
    } catch {
      setItems(prev);
      toast.error("Failed to remove");
    }
  }

  if (items === null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Your Watchlist</h1>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const upcoming = items.filter((i) => !(i.released || isReleased(i.releaseDate)));
  const released = items.filter((i) => i.released || isReleased(i.releaseDate));

  const Grid = ({ list }: { list: WatchlistItem[] }) =>
    list.length === 0 ? (
      <p className="py-12 text-center text-muted-foreground">Nothing here yet.</p>
    ) : (
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((i) => (
          <Item key={i.movieId} item={i} onRemove={remove} />
        ))}
      </div>
    );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Your Watchlist</h1>
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({items.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="released">Released ({released.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all"><Grid list={items} /></TabsContent>
        <TabsContent value="upcoming"><Grid list={upcoming} /></TabsContent>
        <TabsContent value="released"><Grid list={released} /></TabsContent>
      </Tabs>
    </div>
  );
}
