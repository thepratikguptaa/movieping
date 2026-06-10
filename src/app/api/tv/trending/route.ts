import { NextResponse } from "next/server";
import { getTrendingTv, normalizeMulti } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getTrendingTv("week");
    return NextResponse.json({ results: normalizeMulti(data.results, "tv") });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
