import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, Calendar, CheckCircle2, RotateCw, Tv, Layers } from "lucide-react";
import { getTvDetails, getAllOttRegions, WATCH_REGION, TmdbError } from "@/lib/tmdb";
import { posterUrl, backdropUrl } from "@/lib/tmdb";
import type { RegionOtt } from "@/lib/tmdb";
import { WhereToWatch } from "@/components/where-to-watch";
import { formatDate, isReleased } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MovieActions } from "@/components/movie-actions";
import type { TMDBTvDetails } from "@/types";

export const revalidate = 3600;

export default async function TvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tvId = Number(id);
  if (!Number.isFinite(tvId)) notFound();

  let show: TMDBTvDetails;
  try {
    show = await getTvDetails(tvId);
  } catch (err) {
    if (err instanceof TmdbError && err.status === 404) notFound();
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-bold">Couldn&apos;t load this series</h1>
        <p className="max-w-md text-muted-foreground">
          We had trouble reaching the streaming service. This is usually a flaky
          network or VPN connection — please try again.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href={`/tv/${tvId}`}>
              <RotateCw className="h-4 w-4" /> Retry
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const backdrop = backdropUrl(show.backdrop_path);
  const poster = posterUrl(show.poster_path, "w500");
  const cast = show.credits?.cast?.slice(0, 12) ?? [];
  const aired = isReleased(show.first_air_date);

  // Streaming availability across all regions (best-effort).
  let ottRegions: RegionOtt[] | null = null;
  try {
    ottRegions = await getAllOttRegions(tvId, "tv");
  } catch {
    ottRegions = null;
  }
  // Region-specific: is it streaming in the user's watch region?
  const streamingInRegion = !!ottRegions?.some((r) => r.region === WATCH_REGION);

  return (
    <div className="-mt-6 md:-mt-8">
      <div className="relative -mx-4 h-[60vh] min-h-[320px] md:h-[78vh]">
        {backdrop && (
          <Image
            src={backdrop}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-top"
          />
        )}
        <div className="hero-fade absolute inset-0" />
      </div>

      <div className="relative z-10 -mt-32 md:-mt-48">
        <div className="flex flex-col gap-6 md:flex-row md:items-end">
          <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-lg border border-border shadow-2xl md:mx-0 md:w-56">
            {poster && <Image src={poster} alt={show.name} fill className="object-cover" />}
          </div>

          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <h1 className="text-3xl font-extrabold md:text-4xl">{show.name}</h1>
              {show.tagline && (
                <p className="mt-1 italic text-muted-foreground">{show.tagline}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm md:justify-start">
              {show.vote_average > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {show.vote_average.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-4 w-4" /> {formatDate(show.first_air_date)}
              </span>
              {show.number_of_seasons ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Layers className="h-4 w-4" /> {show.number_of_seasons} season
                  {show.number_of_seasons === 1 ? "" : "s"}
                </span>
              ) : null}
              <Badge variant="secondary" className="gap-1">
                <Tv className="h-3 w-3" /> Series
              </Badge>
              {aired ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Aired
                </Badge>
              ) : (
                <Badge>Upcoming</Badge>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              {show.genres.map((g) => (
                <Badge key={g.id} variant="secondary">{g.name}</Badge>
              ))}
            </div>

            <div className="flex justify-center md:justify-start">
              <MovieActions
                movieId={show.id}
                mediaType="tv"
                title={show.name}
                posterPath={show.poster_path}
                releaseDate={show.first_air_date || null}
                streaming={streamingInRegion}
              />
            </div>
          </div>
        </div>

        {/* Overview */}
        <section className="mt-10 max-w-3xl">
          <h2 className="text-xl font-bold">Overview</h2>
          <p className="mt-2 text-justify leading-relaxed text-muted-foreground">
            {show.overview || "No overview available."}
          </p>
        </section>

        {/* Where to watch */}
        {ottRegions && (
          <WhereToWatch regions={ottRegions} defaultRegion={WATCH_REGION} />
        )}

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
