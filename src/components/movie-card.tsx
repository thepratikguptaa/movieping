"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Star, ImageOff, Tv, Film } from "lucide-react";
import { posterUrl } from "@/lib/tmdb";
import { formatDate, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { MediaType } from "@/types";

export interface MovieCardData {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
  vote_average?: number;
  mediaType?: MediaType;
  /** Optional "why we recommended this" note shown on recommendation rows. */
  reason?: string;
}

export function MovieCard({ movie }: { movie: MovieCardData }) {
  const img = posterUrl(movie.poster_path, "w342");
  const isTv = movie.mediaType === "tv";
  const href = `/${isTv ? "tv" : "movie"}/${movie.id}`;
  return (
    <motion.div
      whileHover={{ scale: 1.05, zIndex: 10 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group relative"
    >
      <Link href={href} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-secondary shadow-md transition-shadow group-hover:shadow-2xl group-hover:shadow-black/50">
          <span
            className={cn(
              "absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase shadow-lg ring-1",
              isTv
                ? "bg-primary text-white ring-black/20"
                : "bg-white text-black ring-black/10"
            )}
          >
            {isTv ? <Tv className="h-3 w-3" /> : <Film className="h-3 w-3" />}
            {isTv ? "Series" : "Movie"}
          </span>
          {img ? (
            <Image
              src={img}
              alt={movie.title}
              fill
              sizes="(max-width: 768px) 40vw, 200px"
              className="object-cover transition-opacity group-hover:opacity-90"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ImageOff className="h-8 w-8" />
            </div>
          )}
          {typeof movie.vote_average === "number" && movie.vote_average > 0 && (
            <Badge className="absolute bottom-2 right-2 z-10 gap-1 bg-black/75 text-white shadow-md">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {movie.vote_average.toFixed(1)}
            </Badge>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
            <p className="line-clamp-2 text-sm font-semibold">{movie.title}</p>
            <p className="text-xs text-muted-foreground">{formatDate(movie.release_date)}</p>
          </div>
        </div>
        {/* Always-visible reason caption — hover overlays don't work on touch. */}
        {movie.reason && (
          <p className="mt-1.5 line-clamp-2 px-0.5 text-[11px] leading-snug text-primary/90">
            {movie.reason}
          </p>
        )}
      </Link>
    </motion.div>
  );
}
