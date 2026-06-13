import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import type { MediaType, NotificationType } from "@/types";

const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

interface PushArgs {
  uid: string;
  type: NotificationType;
  title: string;
  body: string;
  movieId: number;
  mediaType?: MediaType;
  posterPath: string | null;
}

/**
 * Send a push to every device a user has and record it in their notification
 * history. Always logs history (even with no device token). Prunes dead tokens.
 * Returns the number of devices successfully reached.
 */
async function pushToUser({
  uid,
  type,
  title,
  body,
  movieId,
  mediaType = "movie",
  posterPath,
}: PushArgs): Promise<number> {
  // Relative path on purpose: it resolves to whatever origin the app is served
  // from (in-app links use the current origin; the service worker resolves it
  // against its scope = the deployed domain for push clicks). Storing an
  // absolute URL froze the origin at generation time (e.g. localhost in dev).
  const url = `/${mediaType}/${movieId}`;

  await adminDb
    .collection("users")
    .doc(uid)
    .collection("notifications")
    .add({ type, title, body, movieId, mediaType, posterPath: posterPath ?? null, url, read: false, createdAt: Date.now() });

  const tokensSnap = await adminDb.collection("users").doc(uid).collection("fcmTokens").get();
  if (tokensSnap.empty) return 0;

  const tokens = tokensSnap.docs.map((d) => ({ id: d.id, token: d.get("token") as string }));

  // Data-only message: we deliberately omit the `notification` payload so the
  // FCM SDK does NOT auto-display it. Our service worker's onBackgroundMessage
  // handler renders the notification from `data`. Sending both causes the
  // browser to show the alert twice.
  const resp = await adminMessaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    data: {
      title,
      body,
      movieId: String(movieId),
      url,
      poster: posterPath ? `${POSTER_BASE}${posterPath}` : "",
    },
  });

  // Clean up dead tokens.
  await Promise.all(
    resp.responses.map(async (r, i) => {
      if (r.success) return;
      const code = r.error?.code ?? "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        await adminDb.collection("users").doc(uid).collection("fcmTokens").doc(tokens[i].id).delete();
      }
    })
  );

  return resp.successCount;
}

/** "Now Showing" — a waitlisted movie has released. */
export function notifyUserOfRelease(args: {
  uid: string;
  movieId: number;
  title: string;
  posterPath: string | null;
}): Promise<number> {
  return pushToUser({
    ...args,
    type: "release",
    title: "🎬 Now Showing",
    body: `${args.title} is out now. Tap to view details.`,
  });
}

/** "Now Streaming" — a waitlisted title has landed on an OTT platform. */
export function notifyUserOfOtt(args: {
  uid: string;
  movieId: number;
  mediaType?: MediaType;
  title: string;
  posterPath: string | null;
  providers: string[];
}): Promise<number> {
  const where = args.providers.length
    ? ` on ${args.providers.slice(0, 3).join(", ")}`
    : "";
  return pushToUser({
    uid: args.uid,
    movieId: args.movieId,
    mediaType: args.mediaType ?? "movie",
    posterPath: args.posterPath,
    type: "ott",
    title: "📺 Now Streaming",
    body: `${args.title} is now streaming${where}. Tap to watch.`,
  });
}

/** "New Season" — a tracked series has a new season available to stream. */
export function notifyUserOfNewSeason(args: {
  uid: string;
  movieId: number;
  title: string;
  posterPath: string | null;
  seasonNumber: number;
  providers: string[];
}): Promise<number> {
  const where = args.providers.length
    ? ` on ${args.providers.slice(0, 3).join(", ")}`
    : "";
  return pushToUser({
    uid: args.uid,
    movieId: args.movieId,
    mediaType: "tv",
    posterPath: args.posterPath,
    type: "season",
    title: "📺 New Season",
    body: `${args.title} Season ${args.seasonNumber} is now streaming${where}. Tap to watch.`,
  });
}
