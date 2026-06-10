import { NextResponse } from "next/server";
import { searchMulti, normalizeMulti } from "@/lib/tmdb";

export const runtime = "nodejs";

// Unified search across movies + series (TMDB /search/multi). People are
// dropped during normalization. The movie-only /api/movies/search is kept for
// the onboarding favorite-movies picker.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  if (!query) return NextResponse.json({ results: [], page: 1, totalPages: 0, totalResults: 0 });

  try {
    const data = await searchMulti(query, page);
    return NextResponse.json({
      results: normalizeMulti(data.results),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed" },
      { status: 500 }
    );
  }
}
