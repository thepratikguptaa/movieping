"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { getWatchlist } from "@/lib/firebase/db";
import { MovieRow, MovieRowSkeleton } from "@/components/movie-row";
import type { MovieCardData } from "@/components/movie-card";
import type { TMDBMovie, WatchlistItem } from "@/types";

async function fetchRow<T = TMDBMovie>(url: string): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [trending, setTrending] = useState<TMDBMovie[] | null>(null);
  const [upcoming, setUpcoming] = useState<TMDBMovie[] | null>(null);
  const [recs, setRecs] = useState<MovieCardData[] | null>(null);
  const [trendingTv, setTrendingTv] = useState<MovieCardData[] | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | null>(null);

  useEffect(() => {
    fetchRow("/api/movies/trending").then(setTrending);
    fetchRow("/api/movies/upcoming").then(setUpcoming);
    fetchRow<MovieCardData>("/api/tv/trending").then(setTrendingTv);
  }, []);

  useEffect(() => {
    if (!profile) return;
    getWatchlist(profile.uid)
      .then(async (wl) => {
        setWatchlist(wl);
        // Drive content-based recommendations from the actual watchlist
        // (most-recent first), falling back to stated preferences for cold start.
        const seeds = [...wl]
          .sort((a, b) => b.addedAt - a.addedAt)
          .map((w) => ({ id: w.movieId, mediaType: w.mediaType ?? "movie", notify: w.notify }));
        const res = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            watchlist: seeds,
            preferences: {
              genres: profile.preferences.genres,
              tvGenres: profile.preferences.tvGenres ?? [],
              language: profile.preferences.languages[0],
            },
          }),
        });
        const data = res.ok ? await res.json() : { results: [] };
        setRecs(data.results ?? []);
      })
      .catch(() => {
        setWatchlist([]);
        setRecs([]);
      });
  }, [profile]);

  const watchlistCards: MovieCardData[] = (watchlist ?? []).map((w) => ({
    id: w.movieId,
    title: w.title,
    poster_path: w.posterPath,
    release_date: w.releaseDate ?? undefined,
    mediaType: w.mediaType,
  }));

  return (
    <div className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="text-2xl font-bold md:text-3xl">
          Welcome back{profile?.displayName ? `, ${profile.displayName.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="text-muted-foreground">Here&apos;s what&apos;s worth your watchlist.</p>
      </motion.div>

      {recs === null ? (
        <MovieRowSkeleton title="Recommended for you" />
      ) : (
        <MovieRow
          title="Recommended for you"
          movies={recs}
          emptyHint="Set more preferences to get tailored picks."
        />
      )}

      {upcoming === null ? (
        <MovieRowSkeleton title="Upcoming releases" />
      ) : (
        <MovieRow title="Upcoming releases" movies={upcoming} />
      )}

      {trending === null ? (
        <MovieRowSkeleton title="Trending movies" />
      ) : (
        <MovieRow title="Trending movies" movies={trending} />
      )}

      {trendingTv === null ? (
        <MovieRowSkeleton title="Trending series" />
      ) : (
        <MovieRow title="Trending series" movies={trendingTv} />
      )}

      {watchlist === null ? (
        <MovieRowSkeleton title="Your watchlist" />
      ) : (
        <MovieRow
          title="Your watchlist"
          movies={watchlistCards}
          emptyHint="Your watchlist is empty — add a movie to get release pings."
        />
      )}
    </div>
  );
}
