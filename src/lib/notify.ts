import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import type { NotificationType } from "@/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

interface PushArgs {
  uid: string;
  type: NotificationType;
  title: string;
  body: string;
  movieId: number;
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
  posterPath,
}: PushArgs): Promise<number> {
  const url = `${APP_URL}/movie/${movieId}`;

  await adminDb
    .collection("users")
    .doc(uid)
    .collection("notifications")
    .add({ type, title, body, movieId, posterPath: posterPath ?? null, url, read: false, createdAt: Date.now() });

  const tokensSnap = await adminDb.collection("users").doc(uid).collection("fcmTokens").get();
  if (tokensSnap.empty) return 0;

  const tokens = tokensSnap.docs.map((d) => ({ id: d.id, token: d.get("token") as string }));

  const resp = await adminMessaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title, body },
    data: {
      movieId: String(movieId),
      url,
      poster: posterPath ? `${POSTER_BASE}${posterPath}` : "",
    },
    webpush: {
      fcmOptions: { link: url },
      notification: { icon: "/icons/icon-192.png" },
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

/** "Now Streaming" — a waitlisted movie has landed on an OTT platform. */
export function notifyUserOfOtt(args: {
  uid: string;
  movieId: number;
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
    posterPath: args.posterPath,
    type: "ott",
    title: "📺 Now Streaming",
    body: `${args.title} is now streaming${where}. Tap to watch.`,
  });
}
