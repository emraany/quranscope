// app/search/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Fuse from "fuse.js";
import SearchBar from "@/components/SearchBar";
import AyahCard from "@/components/AyahCard";
import SlideToggle from "@/components/SlideToggle";
import ThemeChip from "@/components/ThemeChip";
import BackButton from "@/components/BackButton";

type ThemesIndex = Record<string, string[]>;
type SurahIndexRow = {
  id: number;
  name?: string | null;
  transliteration?: string | null;
  translation?: string | null;
  ayahCount: number;
};
type AyahRow = {
  ref: string;
  surah: number;
  ayah: number;
  arabic: string | null;
  english: string | null;
};

type Mode = "themes" | "keywords";
type MatchMode = "word" | "partial";
type SearchResult = { ref: string; arabic: string; english: string; themes: string[] };

const PER_PAGE = 25;
const BASE = process.env.NEXT_PUBLIC_DATA_BASE_URL || "/data/v1";
const pad3 = (n: number) => String(n).padStart(3, "0");

async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "force-cache", signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function SearchPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const qParam = sp?.get("q") ?? "";
  const modeParam = (sp?.get("mode") as Mode) || "themes";
  const matchParam = ((sp?.get("match") as MatchMode) || "word") as MatchMode;

  const [surahIndex, setSurahIndex] = useState<SurahIndexRow[] | null>(null);
  const [themesIndex, setThemesIndex] = useState<ThemesIndex | null>(null);

  const [query, setQuery] = useState(qParam);
  const [mode, setMode] = useState<Mode>(modeParam);
  const [match, setMatch] = useState<MatchMode>(matchParam);

  const [themeResults, setThemeResults] = useState<SearchResult[]>([]);
  const [keywordResults, setKeywordResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [selectedSurah, setSelectedSurah] = useState<number | "all">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const searchAbortRef = useRef<AbortController | null>(null);
  const seenRefsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [idx, inv] = await Promise.all([
        fetchJSON<SurahIndexRow[]>(`${BASE}/meta/surah-index.json`),
        fetchJSON<ThemesIndex>(`${BASE}/meta/inverse_themes.json`),
      ]);
      if (!cancelled) {
        setSurahIndex(idx ?? []);
        setThemesIndex(inv ?? {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const themeNames = useMemo(() => Object.keys(themesIndex ?? {}), [themesIndex]);

  const surahLabelById = useMemo(() => {
    const m: Record<number, string> = {};
    for (const row of surahIndex ?? []) {
      const label = row.transliteration ?? row.translation ?? row.name ?? String(row.id);
      m[row.id] = label;
    }
    return m;
  }, [surahIndex]);
  const surahLabel = (id: number) => `${id} — ${surahLabelById[id] ?? id}`;

  const refToThemes = useMemo(() => {
    const inv = themesIndex ?? {};
    const m: Record<string, string[]> = {};
    for (const [theme, refs] of Object.entries(inv)) {
      for (const r of refs) (m[r] ??= []).push(theme);
    }
    return m;
  }, [themesIndex]);

  const availableSurahs = useMemo(() => {
    const set = new Set<number>();
    const arr = mode === "themes" ? themeResults : keywordResults;
    for (const r of arr) {
      const sid = Number(r.ref.split(":")[0]);
      if (!Number.isNaN(sid)) set.add(sid);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [mode, themeResults, keywordResults]);

  const parseRef = (ref: string) => {
    const [s, v] = ref.split(":").map(Number);
    return { s: s || 0, v: v || 0 };
  };

  const applyFilterSort = (arr: SearchResult[]) => {
    const filtered = selectedSurah === "all" ? arr : arr.filter((r) => Number(r.ref.split(":")[0]) === selectedSurah);
    const sorted = [...filtered].sort((a, b) => {
      const A = parseRef(a.ref);
      const B = parseRef(b.ref);
      const cmp = A.s === B.s ? A.v - B.v : A.s - B.s;
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  };

  const themeFuse = useMemo(
    () =>
      new Fuse(themeNames, {
        includeScore: true,
        threshold: 0.35,
        distance: 100,
        ignoreLocation: true,
      }),
    [themeNames]
  );

  const replaceURL = (qStr: string, m: Mode, mm: MatchMode) => {
    const p = new URLSearchParams(Array.from(sp?.entries?.() ?? []));
    if (qStr) p.set("q", qStr);
    else p.delete("q");
    p.set("mode", m);
    if (m === "keywords") p.set("match", mm);
    else p.delete("match");
    router.replace(`/search${p.toString() ? `?${p.toString()}` : ""}`, { scroll: false });
  };

  const runThemeSearch = (qTrim: string) => {
    setThemeResults([]);
    setSuggestions([]);
    if (!qTrim) return;

    const inv = themesIndex ?? {};
    const names = Object.keys(inv);

    const exact = names.find((t) => t.toLowerCase() === qTrim.toLowerCase());
    if (!exact) {
      if (qTrim.length >= 2) {
        const sugg = themeFuse
          .search(qTrim, { limit: 5 })
          .map((s) => s.item)
          .filter((s) => s.toLowerCase() !== qTrim.toLowerCase());
        setSuggestions(sugg);
      }
      return;
    }

    const refs = inv[exact] ?? [];
    (async () => {
      const bySurah = new Map<number, AyahRow[]>();
      const results: SearchResult[] = [];
      for (const r of refs) {
        const [sidStr, vidStr] = r.split(":");
        const sid = Number(sidStr);
        const vid = Number(vidStr);
        if (!bySurah.has(sid)) {
          const arr = (await fetchJSON<AyahRow[]>(`${BASE}/surahs/${pad3(sid)}.json`)) ?? [];
          bySurah.set(sid, arr);
        }
        const verse = bySurah.get(sid)!.find((a) => a.ayah === vid);
        if (verse) {
          results.push({
            ref: r,
            arabic: verse.arabic ?? "",
            english: verse.english ?? "",
            themes: [exact],
          });
        }
      }
      setThemeResults(results);
    })();
  };

  const runKeywordSearch = async (qTrim: string, mm: MatchMode) => {
    setKeywordResults([]);
    if (!qTrim) return;

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const signal = controller.signal;

    const lower = qTrim.toLowerCase();
    const englishWordRegex = mm === "word" ? new RegExp(`\\b${escapeRegExp(lower)}\\b`, "i") : null;

    const ids = (surahIndex ?? []).map((s) => s.id);
    if (!ids.length) return;

    const CONCURRENCY = 8;
    let i = 0;

    const work = async () => {
      while (i < ids.length && !signal.aborted) {
        const sid = ids[i++];
        const surah = await fetchJSON<AyahRow[]>(`${BASE}/surahs/${pad3(sid)}.json`, signal);
        if (!surah) continue;

        const found: SearchResult[] = [];
        for (const v of surah) {
          const ref = v.ref;
          const arRaw = v.arabic ?? "";
          const enRaw = v.english ?? "";
          const ar = arRaw.toLowerCase();
          const en = enRaw.toLowerCase();

          const arHit = ar.includes(lower);
          const enHit = mm === "partial" ? en.includes(lower) : englishWordRegex ? englishWordRegex.test(en) : false;

          if (arHit || enHit) {
            found.push({
              ref,
              arabic: arRaw,
              english: enRaw,
              themes: refToThemes[ref] ?? [],
            });
          }
        }

        if (found.length) {
          setKeywordResults((prev) => {
            const seen = seenRefsRef.current;
            const uniqueToAdd: SearchResult[] = [];
            for (const item of found) {
              if (seen.has(item.ref)) continue;
              seen.add(item.ref);
              uniqueToAdd.push(item);
            }
            return uniqueToAdd.length ? [...prev, ...uniqueToAdd] : prev;
          });
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, work));
  };

  const runSearch = async (raw: string, m: Mode, mm: MatchMode = match) => {
    const qTrim = raw.trim();
    setLoading(true);
    setThemeResults([]);
    setKeywordResults([]);
    setSuggestions([]);
    setPage(1);
    setSelectedSurah("all");
    seenRefsRef.current = new Set();
    replaceURL(qTrim, m, mm);

    if (!qTrim) {
      setLoading(false);
      return;
    }

    if (m === "themes") {
      runThemeSearch(qTrim);
      setLoading(false);
    } else {
      await runKeywordSearch(qTrim, mm);
      setLoading(false);
    }
  };

  useEffect(() => {
    setMode(modeParam || "themes");
    setMatch(matchParam || "word");
    setQuery(qParam);
    if (surahIndex && themesIndex) {
      runSearch(qParam, modeParam || "themes", matchParam || "word");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam, modeParam, matchParam, surahIndex, themesIndex]);

  const onSearch = (q: string) => {
    setQuery(q);
    runSearch(q, mode, match);
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    runSearch(query, m, match);
  };

  const switchMatch = (mm: MatchMode) => {
    if (mm === match) return;
    setMatch(mm);
    if (mode === "keywords") {
      runSearch(query, mode, mm);
    }
  };

  const applySuggestion = (s: string) => {
    setQuery(s);
    runSearch(s, "themes", match);
  };

  const slicePage = (arr: SearchResult[], page: number) => arr.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = (arr: SearchResult[]) => Math.max(1, Math.ceil(arr.length / PER_PAGE));

  const activeResults = applyFilterSort(mode === "themes" ? themeResults : keywordResults);

  return (
    <main className="min-h-screen px-4 py-10 flex flex-col items-center">
      <Link href="/" className="font-brand text-5xl font-extrabold tracking-tight hover:underline block text-center">
        QuranScope
      </Link>

      <div className="w-full max-w-5xl mt-2 mb-6">
        <BackButton />
      </div>

      <div className="w-full max-w-3xl">
        <SearchBar
          onSearch={onSearch}
          placeholder={mode === "themes" ? "Search a theme name (e.g., Mercy)" : "Search Arabic or English keywords…"}
        />
      </div>

      <div className="w-full max-w-3xl mt-3 mb-2">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 whitespace-nowrap shrink-0">Search in:</span>
            <SlideToggle
              value={mode}
              onChange={switchMode}
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
                onChange={(v) => switchMatch(v as MatchMode)}
                options={[
                  { label: "Whole Word", value: "word" },
                  { label: "Partial Match", value: "partial" },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-5xl mb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-gray-600">
            {query ? (
              <span>
                Showing {mode}
                {mode === "keywords" ? ` (${match === "word" ? "whole word" : "partial"})` : ""} results for{" "}
                <span className="font-medium">“{query}”</span>
              </span>
            ) : (
              <span>Enter a query to search.</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-700 flex items-center gap-2">
              <span className="whitespace-nowrap">Filter by Surah:</span>
              <select
                value={selectedSurah === "all" ? "all" : String(selectedSurah)}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSurah(val === "all" ? "all" : Number(val));
                  setPage(1);
                }}
                className="border border-gray-300 rounded px-2 py-1 text-sm w-auto max-w-[40vw] flex-none"
              >
                <option value="all">All</option>
                {availableSurahs.map((sid) => (
                  <option key={sid} value={sid}>
                    {surahLabel(sid)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-700 flex items-center gap-2">
              <span className="whitespace-nowrap">Sort:</span>
              <select
                value={sortOrder}
                onChange={(e) => {
                  const v = e.target.value === "desc" ? "desc" : "asc";
                  setSortOrder(v);
                  setPage(1);
                }}
                className="border border-gray-300 rounded px-2 py-1 text-sm w-auto max-w-[40vw] flex-none"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {loading && <div className="w-full max-w-3xl mb-2 text-sm text-gray-600">Searching…</div>}

      {mode === "themes" && suggestions.length > 0 && !loading && (
        <div className="w-full max-w-3xl mb-6">
          <p className="text-sm text-gray-600 mb-2">Did you mean:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <ThemeChip key={s} theme={s} onClick={() => applySuggestion(s)} />
            ))}
          </div>
        </div>
      )}

      <div className="w-full max-w-5xl">
        {query && !loading ? (
          activeResults.length ? (
            <>
              <ul className="space-y-4">
                {(() => {
                  const list = mode === "keywords" ? slicePage(activeResults, page) : activeResults;
                  return list.map((ayah) => (
                    <li key={`${mode}-${ayah.ref}`}>
                      <AyahCard
                        refStr={ayah.ref}
                        arabic={ayah.arabic}
                        translation={ayah.english}
                        themes={ayah.themes}
                        href={`/ayah/${ayah.ref.replace(":", "-")}`}
                        highlightTerm={query}
                      />
                    </li>
                  ));
                })()}
              </ul>

              {mode === "keywords" &&
                (() => {
                  const pages = totalPages(activeResults);
                  return pages > 1 ? (
                    <Pager
                      page={page}
                      pages={pages}
                      onPrev={() => setPage((p) => Math.max(1, p - 1))}
                      onNext={() => setPage((p) => Math.min(pages, p + 1))}
                    />
                  ) : null;
                })()}
            </>
          ) : (
            <div className="text-center text-gray-500 py-10">
              {mode === "themes" ? (
                <p className="text-lg font-medium">
                  No themes found for <span className="text-lg">“{query}”</span>
                </p>
              ) : (
                <p className="text-lg font-medium">
                  No keyword matches for <span className="text-lg">“{query}”</span>
                </p>
              )}
            </div>
          )
        ) : null}
      </div>
    </main>
  );
}

function Pager({
  page,
  pages,
  onPrev,
  onNext,
}: {
  page: number;
  pages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-3 mb-6 flex items-center justify-between text-sm">
      <button
        disabled={page <= 1}
        onClick={onPrev}
        className="px-3 py-1.5 rounded-md border border-gray-300 disabled:opacity-50"
      >
        ← Prev
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button
        disabled={page >= pages}
        onClick={onNext}
        className="px-3 py-1.5 rounded-md border border-gray-300 disabled:opacity-50"
      >
        Next →
      </button>
    </div>
  );
}
