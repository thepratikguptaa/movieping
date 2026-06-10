import { NextResponse } from "next/server";
import { searchMovies } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  // `limit` keeps the lightweight onboarding picker small; the search page omits it.
  const limit = Number(searchParams.get("limit") ?? "0") || 0;

  if (!query) return NextResponse.json({ results: [], page: 1, totalPages: 0, totalResults: 0 });

  try {
    const data = await searchMovies(query, page);
    const results = limit ? data.results.slice(0, limit) : data.results;
    return NextResponse.json({
      results,
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
