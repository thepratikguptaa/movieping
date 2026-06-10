import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/server-auth";
import { isReleased, mediaDocId } from "@/lib/utils";
import { getWatchProviders, getTvDetails, airedSeasonCount } from "@/lib/tmdb";
import type { MediaType } from "@/types";

export const runtime = "nodejs";

interface Body {
  movieId: number;
  mediaType?: MediaType;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
}

// Subscribe the user to release + streaming notifications for a movie.
// Upserts the tracked movie doc (server-only per rules) and registers the subscriber.
export async function POST(req: Request) {
  const decoded = await verifyRequest(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  if (!body.movieId) return NextResponse.json({ error: "Missing movieId" }, { status: 400 });

  const mediaType: MediaType = body.mediaType === "tv" ? "tv" : "movie";
  const isTv = mediaType === "tv";
  const movieRef = adminDb.collection("movies").doc(mediaDocId(mediaType, body.movieId));
  const subRef = movieRef.collection("subscribers").doc(decoded.uid);
  // Series have no theatrical release — they're driven entirely by the OTT
  // checker, so mark them released to keep the release checker out.
  const released = isTv ? true : isReleased(body.releaseDate);

  // Check current streaming status so we don't later fire a "now streaming"
  // alert for something that's already on OTT when the user subscribes.
  let ott = { onOtt: false, providers: [] as { name: string }[], region: "" };
  try {
    ott = await getWatchProviders(body.movieId, undefined, mediaType);
  } catch {
    /* best-effort; treat as not-on-ott */
  }

  // For series, seed the season baseline so we only ping for *future* seasons.
  let seasonCount = 0;
  let latestSeasonAired: string | null = null;
  if (isTv) {
    try {
      const details = await getTvDetails(body.movieId);
      seasonCount = airedSeasonCount(details);
      latestSeasonAired = details.last_air_date ?? null;
    } catch {
      /* best-effort; baseline stays 0 */
    }
  }

  await adminDb.runTransaction(async (tx) => {
    const subSnap = await tx.get(subRef);
    tx.set(
      movieRef,
      {
        movieId: body.movieId,
        mediaType,
        title: body.title,
        posterPath: body.posterPath ?? null,
        releaseDate: body.releaseDate ?? null,
        released,
        onOtt: ott.onOtt,
        ottProviders: ott.providers.map((p) => p.name),
        ottRegion: ott.region,
        lastCheckedAt: Date.now(),
        subscriberCount: FieldValue.increment(subSnap.exists ? 0 : 1),
        ...(isTv ? { seasonCount, latestSeasonAired } : {}),
      },
      { merge: true }
    );
    if (!subSnap.exists) {
      tx.set(subRef, {
        uid: decoded.uid,
        subscribedAt: Date.now(),
        notified: released,
        ottNotified: ott.onOtt, // already streaming → don't re-notify
        ...(isTv ? { lastSeasonNotified: seasonCount } : {}),
      });
    }
  });

  return NextResponse.json({
    ok: true,
    mediaType,
    released,
    alreadyStreaming: ott.onOtt,
    providers: ott.providers.map((p) => p.name),
  });
}

// Unsubscribe the user from a movie's release notifications.
export async function DELETE(req: Request) {
  const decoded = await verifyRequest(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const movieId = searchParams.get("movieId");
  if (!movieId) return NextResponse.json({ error: "Missing movieId" }, { status: 400 });
  const mediaType: MediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";

  const movieRef = adminDb.collection("movies").doc(mediaDocId(mediaType, Number(movieId)));
  const subRef = movieRef.collection("subscribers").doc(decoded.uid);

  await adminDb.runTransaction(async (tx) => {
    const subSnap = await tx.get(subRef);
    if (subSnap.exists) {
      tx.delete(subRef);
      tx.set(movieRef, { subscriberCount: FieldValue.increment(-1) }, { merge: true });
    }
  });

  return NextResponse.json({ ok: true });
}
