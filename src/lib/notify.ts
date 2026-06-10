import { adminDb, adminMessaging } from "@/lib/firebase/admin";

interface ReleaseNotifyArgs {
  uid: string;
  movieId: number;
  title: string;
  posterPath: string | null;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

/**
 * Send a "movie released" push to every device token a user has, and record the
 * notification in their history. Prunes tokens that FCM reports as invalid.
 */
export async function notifyUserOfRelease({
  uid,
  movieId,
  title,
  posterPath,
}: ReleaseNotifyArgs): Promise<number> {
  const tokensSnap = await adminDb
    .collection("users")
    .doc(uid)
    .collection("fcmTokens")
    .get();

  const url = `${APP_URL}/movie/${movieId}`;
  const body = `${title} is out now. Tap to view details.`;

  // Always record history, even if the user has no active device token.
  await adminDb
    .collection("users")
    .doc(uid)
    .collection("notifications")
    .add({
      type: "release",
      title: "🎬 Now Showing",
      body,
      movieId,
      posterPath: posterPath ?? null,
      url,
      read: false,
      createdAt: Date.now(),
    });

  if (tokensSnap.empty) return 0;

  const tokens = tokensSnap.docs.map((d) => ({ id: d.id, token: d.get("token") as string }));

  const resp = await adminMessaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title: "🎬 Now Showing", body },
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
        await adminDb
          .collection("users")
          .doc(uid)
          .collection("fcmTokens")
          .doc(tokens[i].id)
          .delete();
      }
    })
  );

  return resp.successCount;
}
