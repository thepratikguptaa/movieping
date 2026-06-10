import { NextResponse } from "next/server";
import { getUpcoming } from "@/lib/tmdb";
import { isReleased } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getUpcoming();
    // Keep genuinely-unreleased titles, soonest first.
    const results = data.results
      .filter((m) => !isReleased(m.release_date))
      .sort((a, b) => (a.release_date > b.release_date ? 1 : -1));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
