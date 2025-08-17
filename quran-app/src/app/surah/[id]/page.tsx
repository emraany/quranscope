// app/surah/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AyahCard from "@/components/AyahCard";
import { EmptyBlock, LoadingBlock, ErrorBlock } from "@/components/State";
import BackButton from "@/components/BackButton";

type AyahRow = {
  ref: string; // "S:A"
  surah: number;
  ayah: number;
  arabic: string | null;
  english: string | null;
};

type ThemeRow = { ref: string; themes: string[] };

type SurahIndexRow = {
  id: number;
  name?: string | null;
  transliteration?: string | null;
  translation?: string | null;
  type?: string | null;
  ayahCount: number;
};

const BASE = process.env.NEXT_PUBLIC_DATA_BASE_URL || "/data/v1";
const pad3 = (n: number) => String(n).padStart(3, "0");

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function SurahPage() {
  const { id } = useParams() as { id: string };
  const surahId = Number(id);

  const [ayahs, setAyahs] = useState<AyahRow[] | null>(null);
  const [themesRows, setThemesRows] = useState<ThemeRow[] | null>(null);
  const [surahMeta, setSurahMeta] = useState<SurahIndexRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const ayahRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const [flashAyah, setFlashAyah] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setDataError(null);

      const [surahData, themesData, index] = await Promise.all([
        fetchJSON<AyahRow[]>(`${BASE}/surahs/${pad3(surahId)}.json`),
        fetchJSON<ThemeRow[]>(`${BASE}/themes/${pad3(surahId)}.json`),
        fetchJSON<SurahIndexRow[]>(`${BASE}/meta/surah-index.json`),
      ]);

      if (!cancelled) {
        setAyahs(surahData ?? []);
        setThemesRows(themesData ?? []);
        const meta = (index ?? [])?.find?.((r) => r.id === surahId) ?? null;
        setSurahMeta(meta);
        if (!surahData) setDataError("Couldn’t load this surah.");
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [surahId]);

  const refToThemes = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const row of themesRows ?? []) {
      map[row.ref] = row.themes ?? [];
    }
    return map;
  }, [themesRows]);

  const flash = (n: number) => {
    setFlashAyah(n);
    setTimeout(() => setFlashAyah(null), 2000);
  };

  const onJump = (val: string) => {
    const n = Number(val);
    const el = ayahRefs.current.get(n);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      flash(n);
    }
  };

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const match = hash.match(/^#ayah-(\d+)$/);
    if (match) {
      const n = Number(match[1]);
      const el = ayahRefs.current.get(n);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          flash(n);
        }, 50);
      }
    }
  }, [ayahs]);

  if (Number.isNaN(surahId) || surahId < 1 || surahId > 114) {
    return (
      <main className="min-h-screen px-4 py-10 flex flex-col items-center">
        <EmptyBlock hint="That surah ID isn’t valid. Try 1–114." />
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-10 flex flex-col items-center">
        <div className="w-full max-w-3xl">
          <LoadingBlock label="Loading surah…" />
        </div>
      </main>
    );
  }

  if (dataError) {
    return (
      <main className="min-h-screen px-4 py-10 flex flex-col items-center">
        <div className="w-full max-w-3xl">
          <ErrorBlock msg={dataError} />
        </div>
      </main>
    );
  }

  if (!ayahs || ayahs.length === 0) {
    return (
      <main className="min-h-screen px-4 py-10 flex flex-col items-center">
        <EmptyBlock hint="Surah not found." />
      </main>
    );
  }

  const headerLabel = surahMeta?.transliteration ?? surahMeta?.translation ?? surahMeta?.name ?? String(surahId);
  const headerType = surahMeta?.type ? surahMeta.type[0]?.toUpperCase() + surahMeta.type.slice(1) : "—";
  const totalVerses = ayahs.length;

  return (
    <main className="min-h-screen px-4 py-10 flex flex-col items-center">
      <Link href="/" className="font-brand text-5xl font-extrabold tracking-tight hover:underline">
        QuranScope
      </Link>

      <div className="w-full max-w-3xl mt-4 mb-6">
        <BackButton />
      </div>

      <div className="w-full max-w-3xl mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="font-brand text-3xl font-semibold">
              {headerLabel}{" "}
              <span className="text-gray-500">({surahMeta?.translation ?? headerLabel})</span>
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Surah {surahId} • {headerType} • {totalVerses} ayahs
            </p>
          </div>

          <label className="text-sm text-gray-700">
            Jump to Ayah:&nbsp;
            <select
              onChange={(e) => onJump(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Select…
              </option>
              {ayahs.map((v) => (
                <option key={v.ayah} value={v.ayah}>
                  {v.ayah}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="w-full max-w-3xl">
        <ul className="space-y-4">
          {ayahs.map((v) => {
            const refStr = v.ref;
            const themes = refToThemes[refStr] ?? [];
            const isFlashing = flashAyah === v.ayah;

            return (
              <li
                id={`ayah-${v.ayah}`}
                key={v.ref}
                ref={(el) => {
                  if (el) ayahRefs.current.set(v.ayah, el);
                  else ayahRefs.current.delete(v.ayah);
                }}
                className={isFlashing ? "ring-2 ring-yellow-300 rounded-lg" : "rounded-lg"}
              >
                <AyahCard
                  refStr={refStr}
                  arabic={v.arabic || ""}
                  translation={v.english || ""}
                  themes={themes}
                  href={`/ayah/${surahId}-${v.ayah}`}
                  flash={isFlashing}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
