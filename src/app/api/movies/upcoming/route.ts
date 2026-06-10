import { NextResponse } from "next/server";
import { getUpcoming } from "@/lib/tmdb";
import { isReleased } from "@/lib/utils";
import type { TMDBMovie } from "@/types";

export const runtime = "nodejs";

// How many TMDB pages to pull (20 results each) to fill the row.
const PAGES = 4;

export async function GET() {
  try {
    const pages = await Promise.all(
      Array.from({ length: PAGES }, (_, i) => getUpcoming(i + 1))
    );

    // Merge pages, drop already-released titles, de-dupe, soonest first.
    const seen = new Set<number>();
    const results: TMDBMovie[] = [];
    for (const page of pages) {
      for (const m of page.results) {
        if (seen.has(m.id) || isReleased(m.release_date)) continue;
        seen.add(m.id);
        results.push(m);
      }
    }
    results.sort((a, b) => (a.release_date > b.release_date ? 1 : -1));

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
