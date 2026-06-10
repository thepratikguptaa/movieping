import { NextResponse } from "next/server";
import { getGenres } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const genres = await getGenres();
    return NextResponse.json({ genres });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
