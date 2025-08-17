// app/surah/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";

type SurahIndexRow = {
  id: number;
  name?: string | null;
  transliteration?: string | null;
  translation?: string | null;
  type?: string | null;
  ayahCount: number;
};

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

export default function SurahIndexPage() {
  const [rows, setRows] = useState<SurahIndexRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await fetchJSON<SurahIndexRow[]>(`${BASE}/meta/surah-index.json`);
      if (!cancelled) {
        setRows(data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-10 flex flex-col items-center">
        <Link href="/" className="font-brand text-5xl font-extrabold tracking-tight mb-8 hover:underline">
          QuranScope
        </Link>
        <div className="w-full max-w-3xl space-y-3" aria-hidden="true">
          <div className="h-6 w-1/2 bg-gray-200 rounded animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <main className="min-h-screen px-4 py-10 flex flex-col items-center">
        <Link href="/" className="font-brand text-5xl font-extrabold tracking-tight mb-8 hover:underline">
          QuranScope
        </Link>
        <p className="text-center text-gray-700">No surah index found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 flex flex-col items-center">
      <Link href="/" className="font-brand text-5xl font-extrabold tracking-tight hover:underline block text-center">
        QuranScope
      </Link>

      <div className="w-full max-w-3xl mt-2 mb-6">
        <BackButton />
      </div>

      <div className="w-full max-w-3xl">
        <h1 className="font-brand text-2xl font-semibold mb-4">Browse Surahs</h1>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((s) => {
            const typeLabel = s.type ? s.type.charAt(0).toUpperCase() + s.type.slice(1) : "—";
            const nameLabel = s.transliteration ?? s.translation ?? s.name ?? String(s.id);

            return (
              <li key={s.id}>
                <Link
                  href={`/surah/${s.id}`}
                  className="block rounded-lg p-4 bg-[#FFF8E7]/90 shadow-sm hover:shadow-md hover:bg-blue-50 transition"
                >
                  <div className="font-semibold">
                    {s.id}. {nameLabel}{" "}
                    {s.translation ? <span className="text-gray-600">({s.translation})</span> : null}
                  </div>
                  <div className="text-xs text-gray-700 mt-1">
                    {typeLabel} • {s.ayahCount} ayahs
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
