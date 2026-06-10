"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MovieCard, type MovieCardData } from "@/components/movie-card";
import { Skeleton } from "@/components/ui/skeleton";

export function MovieRow({
  title,
  movies,
  emptyHint,
}: {
  title: string;
  movies: MovieCardData[];
  emptyHint?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    const el = scroller.current;
    if (!el) return;
    // Scroll by ~90% of the visible width for a natural "next page" feel.
    const amount = el.clientWidth * 0.9;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold md:text-xl">{title}</h2>
      {movies.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint ?? "Nothing here yet."}</p>
      ) : (
        <div className="group relative">
          {/* Left arrow — desktop only, on hover */}
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scroll("left")}
            className="absolute -left-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 p-2 opacity-0 shadow-lg backdrop-blur transition-opacity hover:bg-background group-hover:opacity-100 md:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div
            ref={scroller}
            className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth px-1 pb-2 md:gap-4"
          >
            {movies.map((m) => (
              <div key={`${m.mediaType ?? "movie"}-${m.id}`} className="w-32 shrink-0 md:w-40 lg:w-44">
                <MovieCard movie={m} />
              </div>
            ))}
          </div>

          {/* Right arrow — desktop only, on hover */}
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scroll("right")}
            className="absolute -right-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 p-2 opacity-0 shadow-lg backdrop-blur transition-opacity hover:bg-background group-hover:opacity-100 md:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </section>
  );
}

export function MovieRowSkeleton({ title }: { title: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold md:text-xl">{title}</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-1 pb-2 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[2/3] w-32 shrink-0 md:w-40 lg:w-44" />
        ))}
      </div>
    </section>
  );
}
