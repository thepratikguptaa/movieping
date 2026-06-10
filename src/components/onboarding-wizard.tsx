"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { savePreferences } from "@/lib/firebase/db";
import { FALLBACK_GENRES, FALLBACK_TV_GENRES, LANGUAGES, INDUSTRIES } from "@/lib/constants";
import { posterUrl } from "@/lib/tmdb";
import type { TMDBGenre, TMDBMovie, UserPreferences } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Chip = { id: string | number; label: string };

function ChipGrid({
  options,
  selected,
  onToggle,
}: {
  options: Chip[];
  selected: Set<string | number>;
  onToggle: (id: string | number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.has(o.id);
        return (
          <button
            key={String(o.id)}
            type="button"
            onClick={() => onToggle(o.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-all",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-secondary/50 hover:border-muted-foreground"
            )}
          >
            {active && <Check className="mr-1 inline h-3.5 w-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function OnboardingWizard() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [genres, setGenres] = useState<Set<number>>(new Set());
  const [tvGenres, setTvGenres] = useState<Set<number>>(new Set());
  const [languages, setLanguages] = useState<Set<string>>(new Set());
  const [industries, setIndustries] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<TMDBMovie[]>([]);

  const [genreOptions, setGenreOptions] = useState<TMDBGenre[]>(FALLBACK_GENRES);
  const [tvGenreOptions, setTvGenreOptions] = useState<TMDBGenre[]>(FALLBACK_TV_GENRES);

  // movie search
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TMDBMovie[]>([]);

  useEffect(() => {
    fetch("/api/movies/recommendations") // warms TMDB; genres come from a dedicated call below
      .catch(() => {});
    // Load live genres if available.
    fetch("/api/movies/genres")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.genres && setGenreOptions(d.genres))
      .catch(() => {});
    fetch("/api/tv/genres")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.genres && setTvGenreOptions(d.genres))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/movies/search?query=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const toggle =
    <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>) =>
    (id: T) =>
      setter((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });

  function addFavorite(m: TMDBMovie) {
    setFavorites((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
    setQ("");
    setResults([]);
  }

  const steps = useMemo(
    () => [
      {
        title: "What movie genres do you love?",
        subtitle: "Pick a few — we'll tailor recommendations.",
        valid: genres.size > 0,
        content: (
          <ChipGrid
            options={genreOptions.map((g) => ({ id: g.id, label: g.name }))}
            selected={genres as Set<string | number>}
            onToggle={(id) => toggle(setGenres)(Number(id))}
          />
        ),
      },
      {
        title: "What about series?",
        subtitle: "Pick the kinds of web series you watch.",
        valid: tvGenres.size > 0,
        content: (
          <ChipGrid
            options={tvGenreOptions.map((g) => ({ id: g.id, label: g.name }))}
            selected={tvGenres as Set<string | number>}
            onToggle={(id) => toggle(setTvGenres)(Number(id))}
          />
        ),
      },
      {
        title: "Preferred languages?",
        subtitle: "Choose the languages you watch in.",
        valid: languages.size > 0,
        content: (
          <ChipGrid
            options={LANGUAGES.map((l) => ({ id: l.code, label: l.label }))}
            selected={languages as Set<string | number>}
            onToggle={(id) => toggle(setLanguages)(String(id))}
          />
        ),
      },
      {
        title: "Favorite movie industries?",
        subtitle: "Where do your favorite films come from?",
        valid: industries.size > 0,
        content: (
          <ChipGrid
            options={INDUSTRIES.map((i) => ({ id: i, label: i }))}
            selected={industries as Set<string | number>}
            onToggle={(id) => toggle(setIndustries)(String(id))}
          />
        ),
      },
      {
        title: "Any all-time favorite movies?",
        subtitle: "Search and add a few. (Optional)",
        valid: true,
        content: (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search movies…"
                className="pl-9"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {results.length > 0 && (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border bg-secondary/40 p-1">
                {results.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addFavorite(m)}
                    className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-accent"
                  >
                    <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-secondary">
                      {posterUrl(m.poster_path, "w185") && (
                        <Image src={posterUrl(m.poster_path, "w185")!} alt="" fill className="object-cover" />
                      )}
                    </div>
                    <span className="text-sm">
                      {m.title}{" "}
                      <span className="text-muted-foreground">
                        {m.release_date ? `(${m.release_date.slice(0, 4)})` : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {favorites.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {favorites.map((m) => (
                  <span
                    key={m.id}
                    className="flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-sm"
                  >
                    {m.title}
                    <button
                      type="button"
                      onClick={() => setFavorites((p) => p.filter((x) => x.id !== m.id))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ),
      },
    ],
    [genres, tvGenres, languages, industries, favorites, genreOptions, tvGenreOptions, q, results, searching]
  );

  const current = steps[step];
  const isLast = step === steps.length - 1;

  async function finish() {
    if (!user) return;
    setSaving(true);
    const prefs: UserPreferences = {
      genres: [...genres],
      tvGenres: [...tvGenres],
      languages: [...languages],
      industries: [...industries],
      favoriteMovies: favorites.map((m) => m.id),
    };
    try {
      await savePreferences(user.uid, prefs);
      await refreshProfile();
      toast.success("You're all set!");
      router.replace("/dashboard");
    } catch (e) {
      toast.error("Couldn't save preferences", {
        description: e instanceof Error ? e.message : String(e),
      });
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* progress */}
        <div className="mb-8 flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-secondary"
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            <p className="text-sm font-medium text-primary">
              Step {step + 1} of {steps.length}
            </p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">{current.title}</h1>
            <p className="mt-1 text-muted-foreground">{current.subtitle}</p>
            <div className="mt-6">{current.content}</div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
          >
            Back
          </Button>
          {isLast ? (
            <Button onClick={finish} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Finish
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!current.valid}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
