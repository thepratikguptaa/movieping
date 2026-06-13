"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, BellRing, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getNotifications, markNotificationRead } from "@/lib/firebase/db";
import { useFcm } from "@/hooks/use-fcm";
import { posterUrl } from "@/lib/tmdb";
import { timeAgo, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { NotificationDoc } from "@/types";

/**
 * Resolve a notification's link to a path on the *current* origin. Older
 * notifications stored an absolute URL (which froze the origin — e.g. localhost
 * generated in dev), so strip any origin and fall back to the title's own page.
 */
function notificationPath(n: NotificationDoc): string {
  if (n.url) {
    if (n.url.startsWith("/")) return n.url;
    try {
      const u = new URL(n.url);
      return u.pathname + u.search;
    } catch {
      /* fall through */
    }
  }
  if (n.movieId) return `/${n.mediaType ?? "movie"}/${n.movieId}`;
  return "/dashboard";
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { permission, registering, enableNotifications } = useFcm();
  const [items, setItems] = useState<NotificationDoc[] | null>(null);

  useEffect(() => {
    if (!user) return;
    getNotifications(user.uid).then(setItems).catch(() => setItems([]));
  }, [user]);

  async function onRead(n: NotificationDoc) {
    if (!user || n.read) return;
    setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
    await markNotificationRead(user.uid, n.id).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Notifications</h1>

      {permission !== "granted" && permission !== "unsupported" && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/40 bg-primary/10 p-4">
          <div className="flex items-center gap-3">
            <BellRing className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Enable push notifications</p>
              <p className="text-sm text-muted-foreground">
                Get pinged the moment your waitlisted movies release.
              </p>
            </div>
          </div>
          <Button onClick={enableNotifications} disabled={registering}>
            {registering ? "Enabling…" : "Enable"}
          </Button>
        </div>
      )}

      {items === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const img = posterUrl(n.posterPath ?? null, "w185");
            return (
              <li key={n.id}>
                <Link
                  href={notificationPath(n)}
                  onClick={() => onRead(n)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent",
                    n.read ? "border-border bg-card" : "border-primary/40 bg-primary/5"
                  )}
                >
                  {img ? (
                    <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-secondary">
                      <Image src={img} alt="" fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-secondary">
                      <Bell className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{n.title}</p>
                      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </div>
                  {n.read && <Check className="h-4 w-4 text-muted-foreground" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
