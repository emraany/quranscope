// app/page.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import ThemeChip from "@/components/ThemeChip";
import SlideToggle from "@/components/SlideToggle";

type SurahIndexRow = {
  id: number;
  name?: string | null;
  transliteration?: string | null;
  translation?: string | null;
  type?: string | null;
  ayahCount: number;
};

type ThemesIndex = Record<string, string[]>;
type Mode = "themes" | "keywords";
type MatchMode = "word" | "partial";

const BASE = process.env.NEXT_PUBLIC_DATA_BASE_URL || "/data/v1";

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function LandingPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("themes");
  const [match, setMatch] = useState<MatchMode>("word");

  const [surahs, setSurahs] = useState<SurahIndexRow[] | null>(null);
  const [themesIndex, setThemesIndex] = useState<ThemesIndex | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [idx, inv] = await Promise.all([
        fetchJSON<SurahIndexRow[]>(`${BASE}/meta/surah-index.json`),
        fetchJSON<ThemesIndex>(`${BASE}/meta/inverse_themes.json`),
      ]);
      if (!cancelled) {
        setSurahs(idx ?? []);
        setThemesIndex(inv ?? {});
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const themeNames = useMemo(() => {
    const keys = Object.keys(themesIndex ?? {});
    return keys.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [themesIndex]);

  const handleSearch = (q: string) => {
    const query = q.trim();
    if (!query) return;
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("mode", mode);
    if (mode === "keywords") params.set("match", match);
    router.push(`/search?${params.toString()}`);
  };

  if (loading) {
    return (
      <main className="min-h-screen px-4 pt-[22vh] pb-16 flex flex-col items-center">
        <h1 className="font-brand text-5xl font-extrabold tracking-tight mb-6">QuranScope</h1>
        <div className="w-full max-w-4xl">
          <SearchBar onSearch={handleSearch} placeholder="Search (choose themes or keywords below)" />
        </div>

        <div className="w-full max-w-4xl mt-3 mb-8">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 whitespace-nowrap shrink-0">Search in:</span>
              <SlideToggle
                value={mode}
                onChange={(v) => setMode(v as Mode)}
                options={[
                  { label: "Themes", value: "themes" },
                  { label: "Keywords", value: "keywords" },
                ]}
              />
            </div>

            {mode === "keywords" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 whitespace-nowrap shrink-0">Match mode:</span>
                <SlideToggle
                  value={match}
                  onChange={(v) => setMatch(v as MatchMode)}
                  options={[
                    { label: "Whole Word", value: "word" },
                    { label: "Partial Match", value: "partial" },
                  ]}
                />
              </div>
            )}
          </div>
        </div>

        <section className="w-full max-w-5xl grid md:grid-cols-[1fr_auto_1fr] gap-6 items-start">
          <div className="rounded-2xl border border-gray-200 bg-[#FFF8E7]/90 shadow-sm p-4">
            <div className="h-5 w-24 bg-gray-200 rounded mb-3 animate-pulse" />
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
          <div className="hidden md:block w-px h-full bg-gray-200 rounded-full" />
          <div className="rounded-2xl border border-gray-200 bg-[#FFF8E7]/90 shadow-sm p-4">
            <div className="h-5 w-24 bg-gray-200 rounded mb-3 animate-pulse" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="h-6 w-24 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pt-[22vh] pb-16 flex flex-col items-center">
      <h1 className="font-brand text-5xl font-extrabold tracking-tight mb-6">QuranScope</h1>

      <div className="w-full max-w-4xl">
        <SearchBar
          onSearch={handleSearch}
          placeholder={mode === "themes" ? "Lookup verses by themes..." : "Lookup English keywords…"}
        />
      </div>

      <div className="w-full max-w-4xl mt-3 mb-8">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 whitespace-nowrap shrink-0">Search in:</span>
            <SlideToggle
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              options={[
                { label: "Themes", value: "themes" },
                { label: "Keywords", value: "keywords" },
              ]}
            />
          </div>

          {mode === "keywords" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 whitespace-nowrap shrink-0">Match mode:</span>
              <SlideToggle
                value={match}
                onChange={(v) => setMatch(v as MatchMode)}
                options={[
                  { label: "Whole Word", value: "word" },
                  { label: "Partial Match", value: "partial" },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      <section className="w-full max-w-5xl grid md:grid-cols-[1fr_auto_1fr] gap-6 items-start">
        <div className="rounded-2xl border border-gray-200 bg-[#FFF8E7]/90 shadow-sm">
          <div className="flex items-baseline justify-between p-4">
            <h2 className="text-xl font-semibold">Surahs</h2>
            <Link href="/surah" className="text-sm text-blue-600 hover:underline">
              Browse all
            </Link>
          </div>
          <div className="max-h-96 overflow-auto px-3 pb-4">
            <ul className="space-y-2">
              {(surahs ?? []).map((s) => {
                const typeLabel = s.type ? s.type[0]?.toUpperCase() + s.type.slice(1) : "—";
                const nameLabel = s.transliteration ?? s.translation ?? s.name ?? String(s.id);
                return (
                  <li key={s.id}>
                    <Link
                      href={`/surah/${s.id}`}
                      className="block rounded-lg px-3 py-2 hover:bg-gray-50 border border-gray-100"
                    >
                      <div className="font-medium">
                        {s.id}. {nameLabel}{" "}
                        {s.translation ? <span className="text-gray-500">({s.translation})</span> : null}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {typeLabel} • {s.ayahCount} ayahs
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="hidden md:block w-px h-full bg-gray-200 rounded-full" />

        <div className="rounded-2xl border border-gray-200 bg-[#FFF8E7]/90 shadow-sm">
          <div className="flex items-baseline justify-between p-4">
            <h2 className="text-xl font-semibold">Themes</h2>
            <Link href="/theme" className="text-sm text-blue-600 hover:underline">
              Browse all
            </Link>
          </div>
          <div className="max-h-96 overflow-auto px-4 pb-5">
            <div className="flex flex-wrap gap-2">
              {themeNames.map((t) => (
                <ThemeChip key={t} theme={t} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
