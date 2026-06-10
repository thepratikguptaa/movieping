"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2, X } from "lucide-react";
import { MovieCard, type MovieCardData } from "@/components/movie-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isReleased } from "@/lib/utils";
import type { TMDBMovie } from "@/types";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [searched, setSearched] = useState(false);

  // Track the active query so paged loads don't mix with a newer search.
  const activeQuery = useRef("");

  const runSearch = useCallback(async (q: string, nextPage: number) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/movies/search?query=${encodeURIComponent(q)}&page=${nextPage}`
      );
      const data = await res.json();
      if (activeQuery.current !== q) return; // a newer search superseded this
      setResults((prev) =>
        nextPage === 1 ? data.results ?? [] : [...prev, ...(data.results ?? [])]
      );
      setPage(data.page ?? nextPage);
      setTotalPages(data.totalPages ?? 0);
      setTotalResults(data.totalResults ?? 0);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  // Debounced search as the user types.
  useEffect(() => {
    const q = query.trim();
    activeQuery.current = q;
    if (!q) {
      setResults([]);
      setSearched(false);
      setTotalResults(0);
      setTotalPages(0);
      return;
    }
    const t = setTimeout(() => runSearch(q, 1), 350);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const shown = upcomingOnly
    ? results.filter((m) => !isReleased(m.release_date))
    : results;

  const cards: MovieCardData[] = shown.map((m) => ({
    id: m.id,
    title: m.title,
    poster_path: m.poster_path,
    release_date: m.release_date,
    vote_average: m.vote_average,
  }));

  const canLoadMore = page < totalPages;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Search movies</h1>
        <p className="text-muted-foreground">
          Find any movie — including every upcoming release — and add it to your watchlist.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title…"
          className="h-12 pl-10 pr-10 text-base"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Button
          variant={upcomingOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUpcomingOnly((v) => !v)}
        >
          Upcoming only
        </Button>
        {searched && (
          <span className="text-sm text-muted-foreground">
            {upcomingOnly
              ? `${shown.length} upcoming of ${results.length} loaded`
              : `${totalResults.toLocaleString()} result${totalResults === 1 ? "" : "s"}`}
          </span>
        )}
      </div>

      {/* Results */}
      {loading && results.length === 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full" />
          ))}
        </div>
      ) : searched && cards.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          {upcomingOnly
            ? "No upcoming movies match — try turning off the filter or loading more."
            : "No movies found. Try a different title."}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {cards.map((m) => (
            <MovieCard key={m.id} movie={m} />
          ))}
        </div>
      )}

      {/* Load more */}
      {canLoadMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="secondary"
            onClick={() => runSearch(activeQuery.current, page + 1)}
            disabled={loading}
          >
            {loading && <Loader2 className="animate-spin" />} Load more
          </Button>
        </div>
      )}
    </div>
  );
}
