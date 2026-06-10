import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/server-auth";
import { isReleased } from "@/lib/utils";
import { getWatchProviders } from "@/lib/tmdb";

export const runtime = "nodejs";

interface Body {
  movieId: number;
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

  const movieRef = adminDb.collection("movies").doc(String(body.movieId));
  const subRef = movieRef.collection("subscribers").doc(decoded.uid);
  const released = isReleased(body.releaseDate);

  // Check current streaming status so we don't later fire a "now streaming"
  // alert for something that's already on OTT when the user subscribes.
  let ott = { onOtt: false, providers: [] as { name: string }[], region: "" };
  try {
    ott = await getWatchProviders(body.movieId);
  } catch {
    /* best-effort; treat as not-on-ott */
  }

  await adminDb.runTransaction(async (tx) => {
    const subSnap = await tx.get(subRef);
    tx.set(
      movieRef,
      {
        movieId: body.movieId,
        title: body.title,
        posterPath: body.posterPath ?? null,
        releaseDate: body.releaseDate ?? null,
        released,
        onOtt: ott.onOtt,
        ottProviders: ott.providers.map((p) => p.name),
        ottRegion: ott.region,
        lastCheckedAt: Date.now(),
        subscriberCount: FieldValue.increment(subSnap.exists ? 0 : 1),
      },
      { merge: true }
    );
    if (!subSnap.exists) {
      tx.set(subRef, {
        uid: decoded.uid,
        subscribedAt: Date.now(),
        notified: released,
        ottNotified: ott.onOtt, // already streaming → don't re-notify
      });
    }
  });

  return NextResponse.json({ ok: true });
}

// Unsubscribe the user from a movie's release notifications.
export async function DELETE(req: Request) {
  const decoded = await verifyRequest(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const movieId = searchParams.get("movieId");
  if (!movieId) return NextResponse.json({ error: "Missing movieId" }, { status: 400 });

  const movieRef = adminDb.collection("movies").doc(movieId);
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
