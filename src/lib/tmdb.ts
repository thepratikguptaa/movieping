import type {
  MediaType,
  TMDBCastMember,
  TMDBGenre,
  TMDBMovie,
  TMDBMovieDetails,
  TMDBPaginatedResponse,
  TMDBTvDetails,
  TMDBTvShow,
} from "@/types";
import type { TitleFeatures } from "@/lib/recommend";
import { isReleased } from "@/lib/utils";

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

  // Retry transient failures (flaky networks/VPNs drop connections with
  // ECONNRESET; TMDB occasionally 5xxs). A genuine 4xx is returned immediately.
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: readToken ? { Authorization: `Bearer ${readToken}` } : {},
        next: { revalidate },
      });

      if (res.ok) return (await res.json()) as T;

      // Client errors (404, 401, …) won't fix themselves — fail fast.
      if (res.status >= 400 && res.status < 500) {
        throw new TmdbError(`TMDB ${path} failed: ${res.status} ${res.statusText}`, res.status);
      }
      // 5xx → retry
      lastErr = new Error(`TMDB ${path} failed: ${res.status} ${res.statusText}`);
    } catch (err) {
      if (err instanceof TmdbError) throw err; // don't retry real 4xx
      lastErr = err; // network error (ECONNRESET / fetch failed) → retry
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 300 * attempt)); // backoff
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(`TMDB ${path} failed`);
}

/** TMDB error carrying the HTTP status so callers can detect a real 404. */
export class TmdbError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "TmdbError";
  }
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

// ----------------------------------------------------------------- TV / series

export function getTvDetails(id: number) {
  return tmdb<TMDBTvDetails>(`/tv/${id}`, { append_to_response: "credits" });
}

export async function getTvGenres(): Promise<TMDBGenre[]> {
  const data = await tmdb<{ genres: TMDBGenre[] }>("/genre/tv/list", {}, 60 * 60 * 24);
  return data.genres;
}

export function getTrendingTv(timeWindow: "day" | "week" = "week", page = 1) {
  return tmdb<TMDBPaginatedResponse<TMDBTvShow>>(`/trending/tv/${timeWindow}`, { page });
}

export function getPopularTv(page = 1) {
  return tmdb<TMDBPaginatedResponse<TMDBTvShow>>("/tv/popular", { page });
}

/** Multi-search across movies + TV (+ people, which we drop on normalize). */
export function searchMulti(query: string, page = 1) {
  return tmdb<TMDBPaginatedResponse<TMDBMultiResult>>(
    "/search/multi",
    { query, page, include_adult: "false" },
    60
  );
}

interface TMDBMultiResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string; // movie
  name?: string; // tv / person
  poster_path?: string | null;
  release_date?: string; // movie
  first_air_date?: string; // tv
  vote_average?: number;
}

/** Common card shape so movies and series render through the same components. */
export interface MediaCard {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
  vote_average?: number;
  mediaType: MediaType;
}

/** Normalize multi-search / TV-list results to {@link MediaCard}, dropping people. */
export function normalizeMulti(
  results: (TMDBMultiResult | TMDBTvShow | TMDBMovie)[],
  forceType?: MediaType
): MediaCard[] {
  const out: MediaCard[] = [];
  for (const r of results) {
    const mediaType = (forceType ?? ("media_type" in r ? r.media_type : "movie")) as
      | MediaType
      | "person";
    if (mediaType === "person") continue;
    const rec = r as TMDBMultiResult;
    out.push({
      id: rec.id,
      title: rec.title ?? rec.name ?? "Untitled",
      poster_path: rec.poster_path ?? null,
      release_date: rec.release_date ?? rec.first_air_date,
      vote_average: rec.vote_average,
      mediaType,
    });
  }
  return out;
}

// -------------------------------------------------- recommendation enrichment

interface TMDBKeyword {
  id: number;
  name: string;
}

const CAST_LIMIT = 6; // top billed actors carry the most "taste" signal
const KEYWORD_LIMIT = 10;

/**
 * Fetch a title's content features (genres, top cast, keywords, language,
 * decade) for the content-based recommender. Cached aggressively (24h) since
 * these rarely change and the same popular titles recur across users.
 */
export async function getTitleFeatures(
  id: number,
  mediaType: MediaType
): Promise<TitleFeatures> {
  const data = await tmdb<
    (TMDBMovieDetails | TMDBTvDetails) & {
      credits?: { cast: TMDBCastMember[] };
      keywords?: { keywords?: TMDBKeyword[]; results?: TMDBKeyword[] };
    }
  >(`/${mediaType}/${id}`, { append_to_response: "credits,keywords" }, 60 * 60 * 24);

  const title = (data as TMDBMovieDetails).title ?? (data as TMDBTvDetails).name ?? "Untitled";
  const date = (data as TMDBMovieDetails).release_date ?? (data as TMDBTvDetails).first_air_date;
  // TMDB returns movie keywords under `.keywords`, TV keywords under `.results`.
  const kwList = data.keywords?.keywords ?? data.keywords?.results ?? [];
  const year = date ? Number(date.slice(0, 4)) || undefined : undefined;

  return {
    id,
    mediaType,
    title,
    posterPath: data.poster_path ?? null,
    releaseDate: date,
    voteAverage: data.vote_average,
    genres: (data.genres ?? []).map((g) => ({ id: g.id, name: g.name })),
    keywords: kwList.slice(0, KEYWORD_LIMIT).map((k) => ({ id: k.id, name: k.name })),
    cast: (data.credits?.cast ?? []).slice(0, CAST_LIMIT).map((c) => ({ id: c.id, name: c.name })),
    language: data.original_language,
    year,
  };
}

/** TMDB's own "more like this" list — the candidate source for the recommender. */
export function getRecommendationsFor(id: number, mediaType: MediaType, page = 1) {
  return tmdb<TMDBPaginatedResponse<TMDBMovie | TMDBTvShow>>(
    `/${mediaType}/${id}/recommendations`,
    { page }
  );
}

/** Count of a series' seasons that have already aired (season_number >= 1). */
export function airedSeasonCount(details: TMDBTvDetails): number {
  return (details.seasons ?? []).filter(
    (s) => s.season_number >= 1 && s.air_date && isReleased(s.air_date)
  ).length;
}

/** Default region for streaming availability (override with WATCH_REGION). */
export const WATCH_REGION = process.env.WATCH_REGION || "US";

interface TMDBProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}
interface TMDBProvidersResult {
  link?: string;
  flatrate?: TMDBProvider[]; // subscription streaming
  free?: TMDBProvider[];
  ads?: TMDBProvider[]; // free with ads
  rent?: TMDBProvider[];
  buy?: TMDBProvider[];
}

export interface OttAvailability {
  onOtt: boolean; // available to stream (subscription / free / ads)
  providers: { name: string; logoPath: string | null }[];
  link: string | null;
  region: string;
}

export interface RegionOtt {
  region: string; // ISO 3166-1 country code
  providers: { name: string; logoPath: string | null }[];
  link: string | null;
}

function streamProviders(r: TMDBProvidersResult) {
  const stream = [...(r.flatrate ?? []), ...(r.free ?? []), ...(r.ads ?? [])];
  const seen = new Set<number>();
  return stream
    .filter((p) => (seen.has(p.provider_id) ? false : seen.add(p.provider_id)))
    .map((p) => ({ name: p.provider_name, logoPath: p.logo_path }));
}

/**
 * Streaming availability across ALL regions where the movie can be streamed.
 * Returns one entry per country that has at least one streaming provider.
 */
export async function getAllOttRegions(
  id: number,
  media: MediaType = "movie"
): Promise<RegionOtt[]> {
  const data = await tmdb<{ results: Record<string, TMDBProvidersResult> }>(
    `/${media}/${id}/watch/providers`,
    {},
    60 * 60 * 6
  );
  const out: RegionOtt[] = [];
  for (const [region, r] of Object.entries(data.results ?? {})) {
    const providers = streamProviders(r);
    if (providers.length) out.push({ region, providers, link: r.link ?? null });
  }
  return out;
}

/**
 * Streaming availability for a movie in a region. "On OTT" means it can be
 * streamed (subscription/free/ad-supported), not just rented or bought.
 */
export async function getWatchProviders(
  id: number,
  region: string = WATCH_REGION,
  media: MediaType = "movie"
): Promise<OttAvailability> {
  const data = await tmdb<{ results: Record<string, TMDBProvidersResult> }>(
    `/${media}/${id}/watch/providers`,
    {},
    60 * 60 * 6
  );
  const r = data.results?.[region];
  const providers = r ? streamProviders(r) : [];

  return {
    onOtt: providers.length > 0,
    providers,
    link: r?.link ?? null,
    region,
  };
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
  language?: string; // single ISO 639-1 code, optional
  page?: number;
  sortBy?: string;
  minVotes?: number;
}) {
  return tmdb<TMDBPaginatedResponse<TMDBMovie>>("/discover/movie", {
    // "|" = OR (match ANY selected genre). "," would mean ALL — far too narrow.
    with_genres: opts.genres?.length ? opts.genres.join("|") : undefined,
    with_original_language: opts.language || undefined,
    sort_by: opts.sortBy || "popularity.desc",
    page: opts.page ?? 1,
    "vote_count.gte": opts.minVotes ?? 30,
    include_adult: "false",
  });
}

/** Discover TV series. NOTE: TMDB TV genre ids differ from movie genre ids, so
 *  recommendations discover TV by language/popularity rather than movie genres. */
export function discoverTv(opts: {
  genres?: number[]; // TMDB *TV* genre ids (distinct from movie genre ids)
  language?: string; // single ISO 639-1 code, optional
  page?: number;
  sortBy?: string;
  minVotes?: number;
}) {
  return tmdb<TMDBPaginatedResponse<TMDBTvShow>>("/discover/tv", {
    with_genres: opts.genres?.length ? opts.genres.join("|") : undefined,
    with_original_language: opts.language || undefined,
    sort_by: opts.sortBy || "popularity.desc",
    page: opts.page ?? 1,
    "vote_count.gte": opts.minVotes ?? 50,
    include_adult: "false",
  });
}
