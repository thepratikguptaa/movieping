import { NextResponse } from "next/server";
import { recommendForUser, type WatchlistSeed } from "@/lib/recommend-server";

export const runtime = "nodejs";

/**
 * Content-based recommendations.
 *
 * POST body:
 *   {
 *     watchlist: [{ id, mediaType, notify }],   // most-recent first
 *     preferences: { genres, tvGenres, language } // used for cold start
 *   }
 *
 * Returns { results: RecommendationCard[] } ranked by similarity to the user's
 * watchlist taste profile (see src/lib/recommend.ts).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      watchlist?: unknown;
      preferences?: { genres?: number[]; tvGenres?: number[]; language?: string };
    };

    const watchlist: WatchlistSeed[] = Array.isArray(body.watchlist)
      ? body.watchlist
          .map((w) => w as Record<string, unknown>)
          .filter((w) => typeof w.id === "number")
          .map((w) => ({
            id: w.id as number,
            mediaType: w.mediaType === "tv" ? "tv" : "movie",
            notify: Boolean(w.notify),
          }))
      : [];

    const results = await recommendForUser(watchlist, body.preferences ?? {});
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
