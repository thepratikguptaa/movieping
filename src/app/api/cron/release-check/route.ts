import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getMovieDetails } from "@/lib/tmdb";
import { isReleased } from "@/lib/utils";
import { notifyUserOfRelease } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Scheduled release checker (Vercel Cron — see vercel.json).
 * 1. Loads tracked movies that haven't been marked released.
 * 2. Re-fetches each from TMDB and detects a release-status change.
 * 3. For newly released movies, notifies all not-yet-notified subscribers.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Also allows
 * manual triggering with the same header.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const moviesSnap = await adminDb
    .collection("movies")
    .where("released", "==", false)
    .get();

  let checked = 0;
  let releasedNow = 0;
  let pushes = 0;

  for (const movieDoc of moviesSnap.docs) {
    checked++;
    const movieId = Number(movieDoc.id);

    let releaseDate: string | null = movieDoc.get("releaseDate") ?? null;
    let title: string = movieDoc.get("title") ?? "A movie";
    let posterPath: string | null = movieDoc.get("posterPath") ?? null;

    // Refresh from TMDB (best-effort; fall back to stored date on failure).
    try {
      const details = await getMovieDetails(movieId);
      releaseDate = details.release_date || releaseDate;
      title = details.title || title;
      posterPath = details.poster_path ?? posterPath;
    } catch {
      /* keep stored values */
    }

    const nowReleased = isReleased(releaseDate);

    await movieDoc.ref.set(
      { releaseDate, title, posterPath, released: nowReleased, lastCheckedAt: Date.now() },
      { merge: true }
    );

    if (!nowReleased) continue;
    releasedNow++;

    // Notify subscribers who haven't been pinged yet.
    const subsSnap = await movieDoc.ref
      .collection("subscribers")
      .where("notified", "==", false)
      .get();

    for (const sub of subsSnap.docs) {
      const uid = sub.get("uid") as string;
      const sent = await notifyUserOfRelease({ uid, movieId, title, posterPath });
      pushes += sent;
      await sub.ref.set({ notified: true }, { merge: true });

      // Reflect released state on the user's watchlist item, if present.
      await adminDb
        .collection("users")
        .doc(uid)
        .collection("watchlist")
        .doc(String(movieId))
        .set({ released: true }, { merge: true })
        .catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, checked, releasedNow, pushes });
}
