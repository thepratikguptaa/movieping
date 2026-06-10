import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getWatchProviders } from "@/lib/tmdb";
import { notifyUserOfOtt } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Scheduled OTT/streaming checker (Vercel Cron — see vercel.json).
 * 1. Loads tracked movies not yet flagged as on OTT.
 * 2. Checks TMDB watch providers for streaming availability in the region.
 * 3. When a movie newly appears on any OTT, notifies subscribers who haven't
 *    been pinged about streaming yet.
 *
 * Auth: same CRON_SECRET bearer as the release checker.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only movies not already known to be streaming.
  const moviesSnap = await adminDb.collection("movies").where("onOtt", "==", false).get();

  let checked = 0;
  let nowStreaming = 0;
  let pushes = 0;

  for (const movieDoc of moviesSnap.docs) {
    checked++;
    const movieId = Number(movieDoc.id);
    const title = (movieDoc.get("title") as string) ?? "A movie";
    const posterPath = (movieDoc.get("posterPath") as string | null) ?? null;

    let onOtt = false;
    let providers: string[] = [];
    let region = "";
    try {
      const ott = await getWatchProviders(movieId);
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
    nowStreaming++;

    const subsSnap = await movieDoc.ref
      .collection("subscribers")
      .where("ottNotified", "==", false)
      .get();

    for (const sub of subsSnap.docs) {
      const uid = sub.get("uid") as string;
      const sent = await notifyUserOfOtt({ uid, movieId, title, posterPath, providers });
      pushes += sent;
      await sub.ref.set({ ottNotified: true }, { merge: true });
    }
  }

  return NextResponse.json({ ok: true, checked, nowStreaming, pushes });
}
