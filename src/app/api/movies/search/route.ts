import { NextResponse } from "next/server";
import { searchMovies } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim();
  if (!query) return NextResponse.json({ results: [] });
  try {
    const data = await searchMovies(query);
    return NextResponse.json({ results: data.results.slice(0, 12) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed" },
      { status: 500 }
    );
  }
}
