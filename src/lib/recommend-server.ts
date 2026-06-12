// ---------------------------------------------------------------------------
// Recommendation orchestration (server-side I/O).
//
// Turns a user's watchlist into personalized picks:
//   1. Enrich watchlisted titles into feature vectors (genres/cast/keywords/…).
//   2. Build a weighted taste profile (alerts-on & recently-added titles count
//      for more).
//   3. Generate candidates from TMDB "more like this" for the strongest seeds.
//   4. Score candidates by cosine similarity to the profile (see ./recommend).
//
// Falls back to preference-based discovery when the watchlist is empty
// (cold start), so new users still get a populated row.
// ---------------------------------------------------------------------------

import type { MediaType } from "@/types";
import {
  getTitleFeatures,
  getRecommendationsFor,
  discoverMovies,
  discoverTv,
  getPopular,
  getPopularTv,
  normalizeMulti,
  type MediaCard,
} from "@/lib/tmdb";
import {
  buildProfile,
  computeIdf,
  rankCandidates,
  explain,
  type LabelMap,
  type TitleFeatures,
} from "@/lib/recommend";

export interface WatchlistSeed {
  id: number;
  mediaType: MediaType;
  notify?: boolean;
}

export interface ColdStartPrefs {
  genres?: number[];
  tvGenres?: number[];
  language?: string;
}

export interface RecommendationCard extends MediaCard {
  reason?: string;
}

const PROFILE_MAX = 24; // watchlist titles enriched into the taste profile
const SEED_MAX = 6; // strongest titles used to pull candidate lists
const CANDIDATE_MAX = 30; // candidates enriched + scored
const ENRICH_CONCURRENCY = 8;

/** Bounded-concurrency map — keeps us well under TMDB's rate limit. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

const seenKey = (mediaType: MediaType, id: number) => `${mediaType}:${id}`;

/**
 * Main entry: personalized recommendations for a user.
 * `watchlist` is ordered most-recent-first (recency drives the profile weight).
 */
export async function recommendForUser(
  watchlist: WatchlistSeed[],
  prefs: ColdStartPrefs
): Promise<RecommendationCard[]> {
  if (watchlist.length === 0) return coldStart(prefs);

  const watched = new Set(watchlist.map((w) => seenKey(w.mediaType, w.id)));

  // 1. Enrich watchlist titles into feature vectors (skip ones TMDB drops).
  const profileSeeds = watchlist.slice(0, PROFILE_MAX);
  const enrichedProfile = (
    await mapLimit(profileSeeds, ENRICH_CONCURRENCY, async (w) => {
      try {
        const features = await getTitleFeatures(w.id, w.mediaType);
        return { w, features };
      } catch {
        return null; // a single bad id shouldn't sink the whole row
      }
    })
  ).filter((x): x is { w: WatchlistSeed; features: TitleFeatures } => x !== null);

  if (enrichedProfile.length === 0) return coldStart(prefs);

  // 2. Per-title weight: alerts-on boosted; recency tapers from newest→oldest.
  const n = enrichedProfile.length;
  const profileItems = enrichedProfile.map(({ w, features }, idx) => {
    const recency = 1 + 0.5 * (1 - idx / n); // 1.5 (newest) → ~1.0 (oldest)
    const notify = w.notify ? 1.6 : 1;
    return { features, weight: recency * notify };
  });

  // 3. Candidates: TMDB "more like this" for the strongest seeds.
  const seeds = enrichedProfile.slice(0, SEED_MAX);
  const candidateMeta = new Map<
    string,
    { id: number; mediaType: MediaType; freq: number; popularity: number }
  >();
  await mapLimit(seeds, ENRICH_CONCURRENCY, async ({ w }) => {
    try {
      const recs = await getRecommendationsFor(w.id, w.mediaType);
      for (const r of recs.results ?? []) {
        const key = seenKey(w.mediaType, r.id);
        if (watched.has(key)) continue; // never recommend something already saved
        if (!r.poster_path) continue;
        const prev = candidateMeta.get(key);
        if (prev) prev.freq += 1;
        else
          candidateMeta.set(key, {
            id: r.id,
            mediaType: w.mediaType,
            freq: 1,
            popularity: r.vote_average ?? 0,
          });
      }
    } catch {
      /* skip a failed seed */
    }
  });

  // Prefer titles recommended by multiple seeds, then by rating.
  const topCandidates = [...candidateMeta.values()]
    .sort((a, b) => b.freq - a.freq || b.popularity - a.popularity)
    .slice(0, CANDIDATE_MAX);

  if (topCandidates.length === 0) return coldStart(prefs);

  const candidateFeatures = (
    await mapLimit(topCandidates, ENRICH_CONCURRENCY, async (c) => {
      try {
        return await getTitleFeatures(c.id, c.mediaType);
      } catch {
        return null;
      }
    })
  ).filter((x): x is TitleFeatures => x !== null);

  // 4. Score. IDF is computed over the working corpus (profile + candidates) so
  //    distinctive features dominate over ubiquitous ones.
  const labels: LabelMap = new Map();
  const corpus = [...enrichedProfile.map((e) => e.features), ...candidateFeatures];
  const idf = computeIdf(corpus);
  const profile = buildProfile(profileItems, idf, labels);
  const ranked = rankCandidates(profile, candidateFeatures, idf, 18);

  return ranked.map(({ features, topFeatures }) => ({
    id: features.id,
    title: features.title,
    poster_path: features.posterPath,
    release_date: features.releaseDate,
    vote_average: features.voteAverage,
    mediaType: features.mediaType,
    reason: explain(topFeatures, labels),
  }));
}

/**
 * Cold start: no watchlist yet, so fall back to discovery on the user's stated
 * preferences (mirrors the legacy /api/movies/recommendations widening).
 */
async function coldStart(prefs: ColdStartPrefs): Promise<RecommendationCard[]> {
  const seen = new Set<number>();
  const out: RecommendationCard[] = [];
  const add = (cards: MediaCard[]) => {
    for (const c of cards) {
      if (c.poster_path && !seen.has(c.id)) {
        seen.add(c.id);
        out.push(c);
      }
    }
  };

  const { genres = [], tvGenres = [], language } = prefs;
  if (genres.length && language) add(normalizeMulti((await discoverMovies({ genres, language })).results, "movie"));
  if (out.length < 12 && genres.length) add(normalizeMulti((await discoverMovies({ genres })).results, "movie"));
  if (tvGenres.length) add(normalizeMulti((await discoverTv({ genres: tvGenres, language })).results, "tv"));
  if (out.length < 12) add(normalizeMulti((await getPopular()).results, "movie"));
  if (out.length < 16) add(normalizeMulti((await getPopularTv()).results, "tv"));

  return out.slice(0, 18);
}
