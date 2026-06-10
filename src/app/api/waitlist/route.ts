import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/server-auth";
import { isReleased } from "@/lib/utils";

export const runtime = "nodejs";

interface Body {
  movieId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
}

// Subscribe the user to release notifications for a movie.
// Upserts the tracked movie doc (server-only per rules) and registers the subscriber.
export async function POST(req: Request) {
  const decoded = await verifyRequest(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  if (!body.movieId) return NextResponse.json({ error: "Missing movieId" }, { status: 400 });

  const movieRef = adminDb.collection("movies").doc(String(body.movieId));
  const subRef = movieRef.collection("subscribers").doc(decoded.uid);
  const released = isReleased(body.releaseDate);

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
        lastCheckedAt: Date.now(),
        subscriberCount: FieldValue.increment(subSnap.exists ? 0 : 1),
      },
      { merge: true }
    );
    if (!subSnap.exists) {
      tx.set(subRef, { uid: decoded.uid, subscribedAt: Date.now(), notified: released });
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
