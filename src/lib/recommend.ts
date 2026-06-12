// ---------------------------------------------------------------------------
// Content-based recommendation engine (pure / no I/O — unit-testable).
//
// Each title is turned into a sparse, weighted feature vector over namespaced
// features (genre / keyword / cast / language / decade). A user's "taste
// profile" is the weighted sum of the vectors of the titles on their watchlist.
// Candidate titles are then ranked by cosine similarity to that profile.
//
// Distinctive features are emphasised with an IDF (inverse-document-frequency)
// weighting computed over the working corpus, so a ubiquitous tag like "Drama"
// counts for far less than a niche keyword ("time loop") or a specific actor.
// This is the classic TF-IDF + cosine content-based recommender.
// ---------------------------------------------------------------------------

import type { MediaType } from "@/types";

/** Normalised feature set for a single title. */
export interface TitleFeatures {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  releaseDate?: string;
  voteAverage?: number;
  genres: { id: number; name: string }[];
  keywords: { id: number; name: string }[];
  cast: { id: number; name: string }[]; // already trimmed to the top billed
  language?: string;
  year?: number;
}

/** Sparse vector: feature key -> weight. */
export type FeatureVector = Map<string, number>;

/** Per-namespace base weights — how much each kind of feature matters. */
const NAMESPACE_WEIGHT: Record<string, number> = {
  genre: 1.0,
  keyword: 1.0,
  cast: 0.8,
  lang: 0.5,
  decade: 0.3,
};

/** Human-readable label for a feature key, for "why we picked this" copy. */
export type LabelMap = Map<string, { namespace: string; label: string }>;

/**
 * Build the raw (pre-IDF) feature vector for a title and register human labels.
 * Cast is capped by the caller (we expect ~5 billed names in `cast`).
 */
export function featureVector(t: TitleFeatures, labels?: LabelMap): FeatureVector {
  const v: FeatureVector = new Map();
  const put = (namespace: string, id: number | string, label: string) => {
    const key = `${namespace}:${id}`;
    v.set(key, (v.get(key) ?? 0) + (NAMESPACE_WEIGHT[namespace] ?? 1));
    labels?.set(key, { namespace, label });
  };

  for (const g of t.genres) put("genre", g.id, g.name);
  for (const k of t.keywords) put("keyword", k.id, k.name);
  for (const c of t.cast) put("cast", c.id, c.name);
  if (t.language) put("lang", t.language, t.language.toUpperCase());
  if (t.year) {
    const decade = Math.floor(t.year / 10) * 10;
    put("decade", decade, `${decade}s`);
  }
  return v;
}

/**
 * Inverse document frequency for every feature across a corpus of titles.
 * idf = ln(1 + N / df) — features present in many titles are down-weighted.
 */
export function computeIdf(corpus: TitleFeatures[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const t of corpus) {
    for (const key of featureVector(t).keys()) {
      df.set(key, (df.get(key) ?? 0) + 1);
    }
  }
  const n = corpus.length || 1;
  const idf = new Map<string, number>();
  for (const [key, count] of df) idf.set(key, Math.log(1 + n / count));
  return idf;
}

/** Multiply a vector's weights by their IDF (missing idf ⇒ neutral 1). */
export function applyIdf(v: FeatureVector, idf: Map<string, number>): FeatureVector {
  const out: FeatureVector = new Map();
  for (const [key, w] of v) out.set(key, w * (idf.get(key) ?? 1));
  return out;
}

/** Add `src` into `target` scaled by `weight` (in place). */
export function addScaled(target: FeatureVector, src: FeatureVector, weight: number): void {
  for (const [key, w] of src) target.set(key, (target.get(key) ?? 0) + w * weight);
}

/**
 * Build a taste profile vector from weighted watchlist titles.
 * `items` carry a per-title weight (e.g. boosted when the user enabled alerts
 * or added it recently). IDF is applied to each title before summing.
 */
export function buildProfile(
  items: { features: TitleFeatures; weight: number }[],
  idf: Map<string, number>,
  labels?: LabelMap
): FeatureVector {
  const profile: FeatureVector = new Map();
  for (const { features, weight } of items) {
    addScaled(profile, applyIdf(featureVector(features, labels), idf), weight);
  }
  return profile;
}

/** Cosine similarity of two sparse vectors (0 when either is empty). */
export function cosineSimilarity(a: FeatureVector, b: FeatureVector): number {
  if (a.size === 0 || b.size === 0) return 0;
  // Iterate the smaller vector for the dot product.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [key, w] of small) {
    const o = large.get(key);
    if (o) dot += w * o;
  }
  if (dot === 0) return 0;
  let na = 0;
  for (const w of a.values()) na += w * w;
  let nb = 0;
  for (const w of b.values()) nb += w * w;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface RankedCandidate {
  features: TitleFeatures;
  score: number;
  /** Feature keys contributing most to the match, best first. */
  topFeatures: string[];
}

/**
 * Score & rank candidates against the profile. Candidates already seen by the
 * user must be filtered out by the caller. Returns descending by score,
 * dropping zero-similarity items.
 */
export function rankCandidates(
  profile: FeatureVector,
  candidates: TitleFeatures[],
  idf: Map<string, number>,
  limit: number
): RankedCandidate[] {
  const ranked: RankedCandidate[] = [];
  for (const c of candidates) {
    const cv = applyIdf(featureVector(c), idf);
    const score = cosineSimilarity(profile, cv);
    if (score <= 0) continue;
    // Contribution of each shared feature = profileWeight * candidateWeight.
    const contrib: { key: string; value: number }[] = [];
    for (const [key, w] of cv) {
      const p = profile.get(key);
      if (p) contrib.push({ key, value: p * w });
    }
    contrib.sort((x, y) => y.value - x.value);
    ranked.push({ features: c, score, topFeatures: contrib.map((x) => x.key) });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

/**
 * Turn the top contributing features into a short "Because you like …" phrase.
 * Prefers concrete signals (keyword / cast / genre) over decade / language.
 */
export function explain(topFeatures: string[], labels: LabelMap): string {
  const priority: Record<string, number> = { keyword: 0, cast: 1, genre: 2, lang: 3, decade: 4 };
  const picked: string[] = [];
  const seen = new Set<string>();
  const ordered = [...topFeatures].sort(
    (a, b) => (priority[labels.get(a)?.namespace ?? ""] ?? 9) - (priority[labels.get(b)?.namespace ?? ""] ?? 9)
  );
  for (const key of ordered) {
    const label = labels.get(key)?.label;
    if (!label || seen.has(label)) continue;
    seen.add(label);
    picked.push(label);
    if (picked.length === 2) break;
  }
  if (picked.length === 0) return "Picked for you";
  return `Because you like ${picked.join(" & ")}`;
}
