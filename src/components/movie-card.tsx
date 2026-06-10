"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Star, ImageOff } from "lucide-react";
import { posterUrl } from "@/lib/tmdb";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface MovieCardData {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
  vote_average?: number;
}

export function MovieCard({ movie }: { movie: MovieCardData }) {
  const img = posterUrl(movie.poster_path, "w342");
  return (
    <motion.div
      whileHover={{ scale: 1.05, zIndex: 10 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group relative"
    >
      <Link href={`/movie/${movie.id}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-secondary shadow-md">
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
            <Badge className="absolute right-2 top-2 gap-1 bg-black/70 text-white">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {movie.vote_average.toFixed(1)}
            </Badge>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
            <p className="line-clamp-2 text-sm font-semibold">{movie.title}</p>
            <p className="text-xs text-muted-foreground">{formatDate(movie.release_date)}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
