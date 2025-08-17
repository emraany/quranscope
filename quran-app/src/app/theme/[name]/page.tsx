// app/theme/[name]/page.tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AyahCard from "@/components/AyahCard";
import { EmptyBlock, LoadingBlock, ErrorBlock } from "@/components/State";
import BackButton from "@/components/BackButton";

type ThemesIndex = Record<string, string[]>;
type AyahRow = { ref: string; surah: number; ayah: number; arabic: string | null; english: string | null };

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

export default function ThemePage() {
  const { name } = useParams() as { name: string };
  const decoded = decodeURIComponent(name || "");

  const [themesIndex, setThemesIndex] = useState<ThemesIndex | null>(null);
  const [items, setItems] = useState<{ ref: string; arabic: string; translation: string; href: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const inv = await fetchJSON<ThemesIndex>(`${BASE}/meta/inverse_themes.json`);
      if (!cancelled) {
        setThemesIndex(inv ?? {});
        if (!inv) setBootError("Couldn’t load theme index.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const themeKey = useMemo(() => {
    const idx = themesIndex ?? {};
    const lower = decoded.toLowerCase();
    const keys = Object.keys(idx);
    const exact = keys.find((k) => k.toLowerCase() === lower);
    if (exact) return exact;
    const contains = keys.find((k) => k.toLowerCase().includes(lower));
    return contains ?? decoded;
  }, [decoded, themesIndex]);

  const refs = useMemo(() => {
    const idx = themesIndex ?? {};
    return (idx[themeKey] ?? []).filter(Boolean);
  }, [themeKey, themesIndex]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!refs.length) {
        setItems([]);
        return;
      }
      setLoading(true);

      const bySurah = new Map<number, number[]>();
      for (const r of refs) {
        const [sStr, aStr] = r.split(":");
        const s = Number(sStr);
        const a = Number(aStr);
        if (!bySurah.has(s)) bySurah.set(s, []);
        bySurah.get(s)!.push(a);
      }

      const out: { ref: string; arabic: string; translation: string; href: string }[] = [];
      for (const [sid, ayahs] of bySurah.entries()) {
        const surah = await fetchJSON<AyahRow[]>(`${BASE}/surahs/${pad3(sid)}.json`);
        if (!surah) continue;
        const setAyahs = new Set(ayahs);
        for (const v of surah) {
          if (setAyahs.has(v.ayah)) {
            out.push({
              ref: v.ref,
              arabic: v.arabic ?? "",
              translation: v.english ?? "",
              href: `/ayah/${sid}-${v.ayah}`,
            });
          }
        }
      }

      if (!cancelled) {
        out.sort((a, b) => {
          const [sa, aa] = a.ref.split(":").map(Number);
          const [sb, ab] = b.ref.split(":").map(Number);
          return sa === sb ? aa - ab : sa - sb;
        });
        setItems(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refs]);

  if (!decoded) {
    return (
      <main className="min-h-screen px-4 py-10 flex flex-col items-center">
        <Link href="/" className="font-brand text-5xl font-extrabold tracking-tight hover:underline block text-center">
          QuranScope
        </Link>
        <div className="w-full max-w-3xl mt-4 mb-8">
          <BackButton />
        </div>
        <EmptyBlock hint="No theme specified." />
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
        <h1 className="font-brand text-3xl font-semibold mb-1">Theme: {themeKey}</h1>

        {bootError && (
          <div className="mb-4">
            <ErrorBlock msg={bootError} />
          </div>
        )}

        {loading ? (
          <div className="mb-6">
            <LoadingBlock label="Loading verses…" />
          </div>
        ) : (
          <p className="text-sm text-gray-600 mb-6">
            {items.length} ayah{items.length === 1 ? "" : "s"} found
          </p>
        )}

        {!loading && refs.length === 0 && <EmptyBlock hint={`No ayahs found for “${decoded}”. Try another theme.`} />}

        {!loading && refs.length > 0 && items.length === 0 && (
          <EmptyBlock hint="We found refs but couldn’t load the verse data." />
        )}

        {!loading && items.length > 0 && (
          <ul className="space-y-4">
            {items.map((it) => (
              <li key={it.ref}>
                <AyahCard refStr={it.ref} arabic={it.arabic} translation={it.translation} themes={[themeKey]} href={it.href} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
