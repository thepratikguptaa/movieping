import { NextResponse } from "next/server";
import {
  discoverMovies,
  discoverTv,
  getPopular,
  getPopularTv,
  normalizeMulti,
  type MediaCard,
} from "@/lib/tmdb";

export const runtime = "nodejs";

// Personalized discovery based on the user's preference query params.
// e.g. /api/movies/recommendations?genres=28,12&languages=en,hi
//
// Movies: preferred language + genres → genres only → popular.
// Series: preferred language → popular (TMDB TV genre ids differ from movie
// ones, so we don't reuse the movie genres for TV).
// The two are then interleaved so series surface alongside movies.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const genres = searchParams.get("genres")?.split(",").map(Number).filter(Boolean) ?? [];
  const tvGenres = searchParams.get("tvGenres")?.split(",").map(Number).filter(Boolean) ?? [];
  const language = searchParams.get("languages")?.split(",").filter(Boolean)[0];

  const MIN = 12;

  function collector() {
    const seen = new Set<number>();
    const out: MediaCard[] = [];
    return {
      out,
      add(cards: MediaCard[]) {
        for (const c of cards) {
          if (c.poster_path && !seen.has(c.id)) {
            seen.add(c.id);
            out.push(c);
          }
        }
      },
    };
  }

  try {
    // --- Movies (existing widening strategy) ---
    const mv = collector();
    if (genres.length && language) {
      mv.add(normalizeMulti((await discoverMovies({ genres, language })).results, "movie"));
    }
    if (mv.out.length < MIN && genres.length) {
      mv.add(normalizeMulti((await discoverMovies({ genres })).results, "movie"));
    }
    if (mv.out.length < MIN) {
      mv.add(normalizeMulti((await getPopular()).results, "movie"));
    }

    // --- Series (TV genres are a distinct TMDB list from movie genres) ---
    const tv = collector();
    if (tvGenres.length && language) {
      tv.add(normalizeMulti((await discoverTv({ genres: tvGenres, language })).results, "tv"));
    }
    if (tv.out.length < 8 && tvGenres.length) {
      tv.add(normalizeMulti((await discoverTv({ genres: tvGenres })).results, "tv"));
    }
    if (tv.out.length < 8 && language) {
      tv.add(normalizeMulti((await discoverTv({ language })).results, "tv"));
    }
    if (tv.out.length < 8) {
      tv.add(normalizeMulti((await getPopularTv()).results, "tv"));
    }

    // Interleave ~2 movies : 1 series so series are present but movies still lead.
    const merged: MediaCard[] = [];
    let mi = 0;
    let ti = 0;
    while (mi < mv.out.length || ti < tv.out.length) {
      if (mi < mv.out.length) merged.push(mv.out[mi++]);
      if (mi < mv.out.length) merged.push(mv.out[mi++]);
      if (ti < tv.out.length) merged.push(tv.out[ti++]);
    }

    return NextResponse.json({ results: merged.slice(0, 24) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
