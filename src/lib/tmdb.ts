import type {
  TMDBGenre,
  TMDBMovie,
  TMDBMovieDetails,
  TMDBPaginatedResponse,
} from "@/types";

const BASE_URL = "https://api.themoviedb.org/3";

export const IMG_BASE = "https://image.tmdb.org/t/p";
export const posterUrl = (path: string | null, size: "w185" | "w342" | "w500" | "original" = "w500") =>
  path ? `${IMG_BASE}/${size}${path}` : null;
export const backdropUrl = (path: string | null, size: "w780" | "w1280" | "original" = "w1280") =>
  path ? `${IMG_BASE}/${size}${path}` : null;

/**
 * Server-side TMDB fetch. Uses the v4 Bearer token if present, otherwise the
 * v3 api_key query param. Never call this from the client (keeps keys server-side).
 */
async function tmdb<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  revalidate = 60 * 60
): Promise<T> {
  const readToken = process.env.TMDB_READ_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;

  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  if (!readToken && apiKey) url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), {
    headers: readToken ? { Authorization: `Bearer ${readToken}` } : {},
    next: { revalidate },
  });

  if (!res.ok) {
    throw new Error(`TMDB ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function getGenres(): Promise<TMDBGenre[]> {
  const data = await tmdb<{ genres: TMDBGenre[] }>("/genre/movie/list", {}, 60 * 60 * 24);
  return data.genres;
}

export function getTrending(timeWindow: "day" | "week" = "week", page = 1) {
  return tmdb<TMDBPaginatedResponse<TMDBMovie>>(`/trending/movie/${timeWindow}`, { page });
}

export function getUpcoming(page = 1) {
  return tmdb<TMDBPaginatedResponse<TMDBMovie>>("/movie/upcoming", { page });
}

export function getPopular(page = 1) {
  return tmdb<TMDBPaginatedResponse<TMDBMovie>>("/movie/popular", { page });
}

export function getMovieDetails(id: number) {
  return tmdb<TMDBMovieDetails>(`/movie/${id}`, { append_to_response: "credits" });
}

export function searchMovies(query: string, page = 1) {
  return tmdb<TMDBPaginatedResponse<TMDBMovie>>(
    "/search/movie",
    { query, page, include_adult: "false" },
    60
  );
}

/** Discover movies tuned to a set of preferences (used for recommendations). */
export function discoverMovies(opts: {
  genres?: number[];
  languages?: string[];
  page?: number;
  sortBy?: string;
}) {
  return tmdb<TMDBPaginatedResponse<TMDBMovie>>("/discover/movie", {
    with_genres: opts.genres?.join(",") || undefined,
    with_original_language: opts.languages?.[0] || undefined,
    sort_by: opts.sortBy || "popularity.desc",
    page: opts.page ?? 1,
    "vote_count.gte": 50,
    include_adult: "false",
  });
}
