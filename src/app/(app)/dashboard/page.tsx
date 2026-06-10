"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { getWatchlist } from "@/lib/firebase/db";
import { MovieRow, MovieRowSkeleton } from "@/components/movie-row";
import type { MovieCardData } from "@/components/movie-card";
import type { TMDBMovie, WatchlistItem } from "@/types";

async function fetchRow(url: string): Promise<TMDBMovie[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [trending, setTrending] = useState<TMDBMovie[] | null>(null);
  const [upcoming, setUpcoming] = useState<TMDBMovie[] | null>(null);
  const [recs, setRecs] = useState<TMDBMovie[] | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | null>(null);

  useEffect(() => {
    fetchRow("/api/movies/trending").then(setTrending);
    fetchRow("/api/movies/upcoming").then(setUpcoming);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const params = new URLSearchParams();
    if (profile.preferences.genres.length)
      params.set("genres", profile.preferences.genres.join(","));
    if (profile.preferences.languages.length)
      params.set("languages", profile.preferences.languages.join(","));
    fetchRow(`/api/movies/recommendations?${params.toString()}`).then(setRecs);
    getWatchlist(profile.uid).then(setWatchlist).catch(() => setWatchlist([]));
  }, [profile]);

  const watchlistCards: MovieCardData[] = (watchlist ?? []).map((w) => ({
    id: w.movieId,
    title: w.title,
    poster_path: w.posterPath,
    release_date: w.releaseDate ?? undefined,
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
        <MovieRowSkeleton title="Trending this week" />
      ) : (
        <MovieRow title="Trending this week" movies={trending} />
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
