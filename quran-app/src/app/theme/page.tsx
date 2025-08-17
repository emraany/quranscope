// app/theme/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ThemeChip from "@/components/ThemeChip";
import BackButton from "@/components/BackButton";

type ThemesIndex = Record<string, string[]>;

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

export default function ThemeIndexPage() {
  const [themesIndex, setThemesIndex] = useState<ThemesIndex | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await fetchJSON<ThemesIndex>(`${BASE}/meta/inverse_themes.json`);
      if (!cancelled) {
        setThemesIndex(data ?? {});
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const themes = useMemo(() => {
    const keys = Object.keys(themesIndex ?? {});
    return keys.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [themesIndex]);

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-10 flex flex-col items-center">
        <Link
          href="/"
          className="font-brand text-5xl font-extrabold tracking-tight hover:underline block text-center mb-8"
        >
          QuranScope
        </Link>

        <div className="w-full max-w-3xl mt-2 mb-6">
          <BackButton />
        </div>

        <div className="w-full max-w-3xl space-y-3" aria-hidden="true">
          <div className="h-6 w-1/2 bg-gray-200 rounded animate-pulse" />
          <div className="rounded border border-gray-200 bg-[#FcF5E8] p-4">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="h-6 w-24 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!themes.length) {
    return (
      <main className="min-h-screen px-4 py-10 flex flex-col items-center">
        <Link
          href="/"
          className="font-brand text-5xl font-extrabold tracking-tight hover:underline block text-center mb-8"
        >
          QuranScope
        </Link>

        <div className="w-full max-w-3xl mt-2 mb-6">
          <BackButton />
        </div>

        <p className="text-gray-700">No themes found.</p>
      </main>
    );
  }

  const groups = themes.reduce<Record<string, string[]>>((acc, t) => {
    const letter = (t[0] || "#").toUpperCase();
    (acc[letter] ??= []).push(t);
    return acc;
  }, {});

  return (
    <main id="top" className="min-h-screen px-4 py-10 flex flex-col items-center [scroll-behavior:smooth]">
      <Link
        href="/"
        className="font-brand text-5xl font-extrabold tracking-tight hover:underline block text-center"
      >
        QuranScope
      </Link>

      <div className="w-full max-w-3xl mt-2 mb-6">
        <BackButton />
      </div>

      <div className="w-full max-w-3xl">
        <h1 className="font-brand text-2xl font-semibold mb-4">Browse Themes</h1>

        <div className="rounded-2xl border border-gray-200 bg-[#Fcf5E8] p-4">
          <div className="-mx-4 mb-4 px-4 py-2 bg-[#FcF5E8] backdrop-blur-sm border-b border-gray-200">
            <div className="flex flex-wrap gap-2 justify-center text-sm">
              <a
                href="#top"
                className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm hover:from-blue-100 hover:to-indigo-100 transition"
              >
                All
              </a>
              {Object.keys(groups)
                .sort()
                .map((ch) => (
                  <a
                    key={ch}
                    href={`#grp-${ch}`}
                    className="px-3 py-1 rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-100 transition"
                  >
                    {ch}
                  </a>
                ))}
            </div>
          </div>

          <div className="space-y-6">
            {Object.entries(groups)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([ch, items]) => (
                <section key={ch} id={`grp-${ch}`} className="scroll-mt-20">
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">{ch}</h2>
                  <div className="flex flex-wrap gap-2">
                    {items.map((t) => (
                      <ThemeChip key={t} theme={t} />
                    ))}
                  </div>
                </section>
              ))}
          </div>
        </div>
      </div>
    </main>
  );
}
