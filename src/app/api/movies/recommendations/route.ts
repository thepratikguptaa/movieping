import { NextResponse } from "next/server";
import { discoverMovies } from "@/lib/tmdb";

export const runtime = "nodejs";

// Personalized discovery based on the user's preference query params.
// e.g. /api/movies/recommendations?genres=28,12&languages=en,hi
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const genres = searchParams.get("genres")?.split(",").map(Number).filter(Boolean) ?? [];
  const languages = searchParams.get("languages")?.split(",").filter(Boolean) ?? [];

  try {
    const data = await discoverMovies({ genres, languages, sortBy: "popularity.desc" });
    return NextResponse.json({ results: data.results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
