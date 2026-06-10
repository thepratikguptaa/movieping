import { NextResponse } from "next/server";
import { discoverMovies, getPopular } from "@/lib/tmdb";
import type { TMDBMovie } from "@/types";

export const runtime = "nodejs";

// Personalized discovery based on the user's preference query params.
// e.g. /api/movies/recommendations?genres=28,12&languages=en,hi
//
// Strategy (each step widens until we have enough): preferred language + genres
// → genres only (any language) → popular. Genres are OR-matched in the client.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const genres = searchParams.get("genres")?.split(",").map(Number).filter(Boolean) ?? [];
  const language = searchParams.get("languages")?.split(",").filter(Boolean)[0];

  const MIN = 12;
  const seen = new Set<number>();
  const results: TMDBMovie[] = [];
  const add = (movies: TMDBMovie[]) => {
    for (const m of movies) {
      if (m.poster_path && !seen.has(m.id)) {
        seen.add(m.id);
        results.push(m);
      }
    }
  };

  try {
    // 1. Genres in the user's language.
    if (genres.length && language) {
      add((await discoverMovies({ genres, language })).results);
    }
    // 2. Genres, any language.
    if (results.length < MIN && genres.length) {
      add((await discoverMovies({ genres })).results);
    }
    // 3. Popular fallback so the row is never empty.
    if (results.length < MIN) {
      add((await getPopular()).results);
    }

    return NextResponse.json({ results: results.slice(0, 20) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
