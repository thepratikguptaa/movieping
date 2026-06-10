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
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold md:text-xl">{title}</h2>
      {movies.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint ?? "Nothing here yet."}</p>
      ) : (
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:gap-4">
          {movies.map((m) => (
            <div key={m.id} className="w-32 shrink-0 md:w-40 lg:w-44">
              <MovieCard movie={m} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function MovieRowSkeleton({ title }: { title: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold md:text-xl">{title}</h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[2/3] w-32 shrink-0 md:w-40 lg:w-44" />
        ))}
      </div>
    </section>
  );
}
