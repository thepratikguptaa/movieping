"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Tv, Globe } from "lucide-react";
import { IMG_BASE } from "@/lib/tmdb";
import type { RegionOtt } from "@/lib/tmdb";

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function WhereToWatch({
  regions,
  defaultRegion,
}: {
  regions: RegionOtt[];
  defaultRegion: string;
}) {
  // Sort regions by display name, with the user's default region pinned first.
  const sorted = useMemo(() => {
    const withNames = regions.map((r) => ({ ...r, name: regionName(r.region) }));
    return withNames.sort((a, b) => {
      if (a.region === defaultRegion) return -1;
      if (b.region === defaultRegion) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [regions, defaultRegion]);

  const [selected, setSelected] = useState<string>(
    sorted.find((r) => r.region === defaultRegion)?.region ?? sorted[0]?.region ?? ""
  );

  const current = sorted.find((r) => r.region === selected);

  if (sorted.length === 0) {
    return (
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <Tv className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Where to watch</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Not on any streaming platform anywhere yet.{" "}
          <span className="text-foreground">
            Add it to your watchlist and we&apos;ll ping you the moment it starts streaming. 📺
          </span>
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tv className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Where to watch</h2>
        </div>

        {/* Region picker — only countries where it actually streams */}
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-9 rounded-md border border-input bg-secondary/50 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {sorted.map((r) => (
              <option key={r.region} value={r.region}>
                {r.name}
                {r.region === defaultRegion ? " (your region)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {current && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {current.providers.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                title={p.name}
              >
                {p.logoPath ? (
                  <Image
                    src={`${IMG_BASE}/w92${p.logoPath}`}
                    alt={p.name}
                    width={28}
                    height={28}
                    className="rounded"
                  />
                ) : (
                  <Tv className="h-6 w-6 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">{p.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Streaming in{" "}
            <span className="font-medium text-foreground">{regionName(current.region)}</span> ·
            available in {sorted.length} region{sorted.length === 1 ? "" : "s"} · data by JustWatch
            {current.link && (
              <>
                {" · "}
                <a
                  href={current.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  More options
                </a>
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}
