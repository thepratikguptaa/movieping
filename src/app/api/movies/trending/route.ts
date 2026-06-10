import { NextResponse } from "next/server";
import { getTrending } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getTrending("week");
    return NextResponse.json({ results: data.results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
