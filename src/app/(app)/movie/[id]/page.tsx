import Image from "next/image";
import { notFound } from "next/navigation";
import { Star, Clock, Calendar, CheckCircle2 } from "lucide-react";
import { getMovieDetails } from "@/lib/tmdb";
import { posterUrl, backdropUrl } from "@/lib/tmdb";
import { formatDate, isReleased } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MovieActions } from "@/components/movie-actions";

export const revalidate = 3600;

export default async function MoviePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isFinite(movieId)) notFound();

  let movie;
  try {
    movie = await getMovieDetails(movieId);
  } catch {
    notFound();
  }

  const backdrop = backdropUrl(movie.backdrop_path);
  const poster = posterUrl(movie.poster_path, "w500");
  const cast = movie.credits?.cast?.slice(0, 12) ?? [];
  const released = isReleased(movie.release_date);

  return (
    <div className="-mt-6 md:-mt-8">
      {/* Backdrop hero */}
      <div className="relative -mx-4 h-[40vh] min-h-[260px] md:h-[55vh]">
        {backdrop && (
          <Image src={backdrop} alt="" fill priority className="object-cover" />
        )}
        <div className="hero-fade absolute inset-0" />
      </div>

      <div className="relative z-10 -mt-32 md:-mt-48">
        <div className="flex flex-col gap-6 md:flex-row md:items-end">
          <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-lg border border-border shadow-2xl md:mx-0 md:w-56">
            {poster && <Image src={poster} alt={movie.title} fill className="object-cover" />}
          </div>

          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <h1 className="text-3xl font-extrabold md:text-4xl">{movie.title}</h1>
              {movie.tagline && (
                <p className="mt-1 italic text-muted-foreground">{movie.tagline}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm md:justify-start">
              {movie.vote_average > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {movie.vote_average.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-4 w-4" /> {formatDate(movie.release_date)}
              </span>
              {movie.runtime ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" /> {movie.runtime} min
                </span>
              ) : null}
              {released ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Released
                </Badge>
              ) : (
                <Badge>Upcoming</Badge>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              {movie.genres.map((g) => (
                <Badge key={g.id} variant="secondary">{g.name}</Badge>
              ))}
            </div>

            <div className="flex justify-center md:justify-start">
              <MovieActions
                movieId={movie.id}
                title={movie.title}
                posterPath={movie.poster_path}
                releaseDate={movie.release_date || null}
              />
            </div>
          </div>
        </div>

        {/* Overview */}
        <section className="mt-10 max-w-3xl">
          <h2 className="text-xl font-bold">Overview</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {movie.overview || "No overview available."}
          </p>
        </section>

        {/* Cast */}
        {cast.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold">Top Cast</h2>
            <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-2">
              {cast.map((c) => {
                const profile = posterUrl(c.profile_path, "w185");
                return (
                  <div key={c.id} className="w-24 shrink-0 text-center">
                    <div className="relative mx-auto aspect-square w-20 overflow-hidden rounded-full bg-secondary">
                      {profile && <Image src={profile} alt={c.name} fill className="object-cover" />}
                    </div>
                    <p className="mt-2 line-clamp-1 text-xs font-medium">{c.name}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{c.character}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
