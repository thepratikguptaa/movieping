import { NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getWatchProviders, getTvDetails, airedSeasonCount } from "@/lib/tmdb";
import { notifyUserOfOtt, notifyUserOfNewSeason } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Scheduled OTT/streaming checker (Vercel Cron — see vercel.json).
 *
 * Movies:
 *   - Loads tracked movies not yet flagged as on OTT.
 *   - When a movie newly appears on OTT, notifies subscribers not yet pinged.
 *
 * Series (mediaType == "tv"):
 *   - Always re-checked (even when already streaming) so we can also detect
 *     *new seasons*.
 *   - First availability → "Now Streaming"; a higher aired-season count than we
 *     last recorded → "New Season".
 *
 * Auth: same CRON_SECRET bearer as the release checker.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = { checked: 0, nowStreaming: 0, newSeasons: 0, pushes: 0 };

  // ---- Movie pass: titles not yet known to be streaming. ------------------
  const movieSnap = await adminDb.collection("movies").where("onOtt", "==", false).get();
  for (const movieDoc of movieSnap.docs) {
    if (movieDoc.get("mediaType") === "tv") continue; // handled in the TV pass
    stats.checked++;
    const movieId = Number(movieDoc.id);
    const title = (movieDoc.get("title") as string) ?? "A movie";
    const posterPath = (movieDoc.get("posterPath") as string | null) ?? null;

    let onOtt = false;
    let providers: string[] = [];
    let region = "";
    try {
      const ott = await getWatchProviders(movieId, undefined, "movie");
      onOtt = ott.onOtt;
      providers = ott.providers.map((p) => p.name);
      region = ott.region;
    } catch {
      continue; // transient TMDB error — try again next run
    }

    await movieDoc.ref.set(
      { onOtt, ottProviders: providers, ottRegion: region, ottCheckedAt: Date.now() },
      { merge: true }
    );

    if (!onOtt) continue;
    stats.nowStreaming++;

    const subsSnap = await movieDoc.ref
      .collection("subscribers")
      .where("ottNotified", "==", false)
      .get();
    for (const sub of subsSnap.docs) {
      const uid = sub.get("uid") as string;
      stats.pushes += await notifyUserOfOtt({ uid, movieId, title, posterPath, providers });
      await sub.ref.set({ ottNotified: true }, { merge: true });
    }
  }

  // ---- TV pass: every tracked series (catches new seasons too). -----------
  const tvSnap = await adminDb.collection("movies").where("mediaType", "==", "tv").get();
  for (const tvDoc of tvSnap.docs) {
    stats.checked++;
    await handleSeries(tvDoc, stats);
  }

  return NextResponse.json({ ok: true, ...stats });
}

async function handleSeries(
  tvDoc: QueryDocumentSnapshot,
  stats: { nowStreaming: number; newSeasons: number; pushes: number }
): Promise<void> {
  const tvId = Number(tvDoc.get("movieId"));
  const title = (tvDoc.get("title") as string) ?? "A series";
  const posterPath = (tvDoc.get("posterPath") as string | null) ?? null;
  const wasOnOtt = (tvDoc.get("onOtt") as boolean) ?? false;
  const prevSeasonCount = (tvDoc.get("seasonCount") as number) ?? 0;

  let onOtt = false;
  let providers: string[] = [];
  let region = "";
  let seasonCount = prevSeasonCount;
  let latestSeasonAired: string | null = (tvDoc.get("latestSeasonAired") as string | null) ?? null;
  try {
    const [ott, details] = await Promise.all([
      getWatchProviders(tvId, undefined, "tv"),
      getTvDetails(tvId),
    ]);
    onOtt = ott.onOtt;
    providers = ott.providers.map((p) => p.name);
    region = ott.region;
    seasonCount = airedSeasonCount(details);
    latestSeasonAired = details.last_air_date ?? latestSeasonAired;
  } catch {
    return; // transient TMDB error — try again next run
  }

  await tvDoc.ref.set(
    {
      onOtt,
      ottProviders: providers,
      ottRegion: region,
      ottCheckedAt: Date.now(),
      seasonCount,
      latestSeasonAired,
    },
    { merge: true }
  );

  if (!onOtt) return;

  // First time it's streaming → "Now Streaming" for not-yet-pinged subscribers.
  if (!wasOnOtt) {
    stats.nowStreaming++;
    const subsSnap = await tvDoc.ref
      .collection("subscribers")
      .where("ottNotified", "==", false)
      .get();
    for (const sub of subsSnap.docs) {
      const uid = sub.get("uid") as string;
      stats.pushes += await notifyUserOfOtt({ uid, movieId: tvId, mediaType: "tv", title, posterPath, providers });
      await sub.ref.set({ ottNotified: true, lastSeasonNotified: seasonCount }, { merge: true });
    }
  }

  // A new season has aired since we last recorded → "New Season".
  if (seasonCount > prevSeasonCount) {
    stats.newSeasons++;
    const subsSnap = await tvDoc.ref
      .collection("subscribers")
      .where("lastSeasonNotified", "<", seasonCount)
      .get();
    for (const sub of subsSnap.docs) {
      const uid = sub.get("uid") as string;
      stats.pushes += await notifyUserOfNewSeason({
        uid,
        movieId: tvId,
        title,
        posterPath,
        seasonNumber: seasonCount,
        providers,
      });
      await sub.ref.set({ lastSeasonNotified: seasonCount, ottNotified: true }, { merge: true });
    }
  }
}
