"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AyahCard from "@/components/AyahCard";
import { EmptyBlock, LoadingBlock, ErrorBlock } from "@/components/State";
import BackButton from "@/components/BackButton";

const BASE = process.env.NEXT_PUBLIC_DATA_BASE_URL || "/data/v2";
const API_BASE = process.env.NEXT_PUBLIC_API_ORIGIN || "http://localhost:8000";
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

type AyahRow = {
  ref: string; // "S:A"
  surah: number;
  ayah: number;
  arabic: string | null;
  english: string | null;
};
type ThemeRow = { ref: string; themes: string[] };

type TafsirPayload = { html?: string; text?: string }; // legacy (per-ayah)
type TafsirAyah = { ayah: number; surah: number; text?: string; html?: string };
type TafsirSurah = { ayahs: TafsirAyah[] };

export default function AyahPage() {
  const { ref } = useParams() as { ref: string };
  const [surahIdStr, ayahIdStr] = String(ref).split("-");
  const surahId = Number(surahIdStr);
  const ayahId = Number(ayahIdStr);
  const key = `${surahId}:${ayahId}`;

  const [ayahs, setAyahs] = useState<AyahRow[] | null>(null);
  const [themesRows, setThemesRows] = useState<ThemeRow[] | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [openTafsir, setOpenTafsir] = useState(false);
  const [tafsirHtml, setTafsirHtml] = useState<string | null>(null);
  const [tafsirLoading, setTafsirLoading] = useState(false);
  const [tafsirError, setTafsirError] = useState<string | null>(null);
  const tafsirCacheRef = useRef<Map<string, string>>(new Map());

  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [showExplainOpts, setShowExplainOpts] = useState(false);
  const [styleOpt, setStyleOpt] = useState<
    "balanced" | "tldr" | "bullets" | "study" | "youth" | "reflection" | "linguistic" | "context"
  >("balanced");
  const [lengthOpt, setLengthOpt] = useState<"short" | "medium">("short");
  const lengthEnabled = !["tldr", "bullets"].includes(styleOpt);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("qs_explain_opts");
      if (saved) {
        const o = JSON.parse(saved);
        if (o.styleOpt) setStyleOpt(o.styleOpt);
        if (o.lengthOpt) setLengthOpt(o.lengthOpt);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("qs_explain_opts", JSON.stringify({ styleOpt, lengthOpt }));
    } catch {}
  }, [styleOpt, lengthOpt]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingData(true);
      setDataError(null);

      const [surahData, themesData] = await Promise.all([
        fetchJSON<AyahRow[]>(`${BASE}/surahs/${pad3(surahId)}.json`),
        fetchJSON<ThemeRow[]>(`${BASE}/themes/${pad3(surahId)}.json`),
      ]);

      if (!cancelled) {
        setAyahs(surahData ?? []);
        setThemesRows(themesData ?? []);
        if (!surahData) setDataError("Couldn’t load this surah’s verses.");
        setLoadingData(false);

        setOpenTafsir(false);
        setTafsirHtml(null);
        setTafsirError(null);
        setExplanation("");
        setShowExplainOpts(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [surahId]);

  const verse = useMemo(() => (ayahs ?? []).find((v) => v.ayah === ayahId) ?? null, [ayahs, ayahId]);
  const themes = useMemo(() => {
    if (!themesRows) return [];
    const hit = themesRows.find((t) => t.ref === key);
    return hit?.themes ?? [];
  }, [themesRows, key]);

  const handleToggleTafsir = async () => {
    if (openTafsir) {
      setOpenTafsir(false);
      return;
    }
    setOpenTafsir(true);

    setShowExplainOpts(false);
    setExplanation("");
    setHasGenerated(false);
    setCacheState(null);

    const cacheKey = `${surahId}:${ayahId}`;
    if (tafsirCacheRef.current.has(cacheKey)) {
      setTafsirHtml(tafsirCacheRef.current.get(cacheKey)!);
      setTafsirError(null);
      return;
    }

    setTafsirLoading(true);
    setTafsirError(null);
    setTafsirHtml(null);

    try {
      // Try per-surah formats located under /data/v2/tafsir/
      const candidates = [
        `${BASE}/tafsir/${surahId}.json`,
        `${BASE}/tafsir/${pad3(surahId)}.json`,
        `${BASE}/tafsir/${surahId}/index.json`,
        `${BASE}/tafsir/${pad3(surahId)}/index.json`,
      ];

      let loaded: TafsirSurah | null = null;
      for (const u of candidates) {
        const j = await fetchJSON<TafsirSurah>(u);
        if (j && Array.isArray(j.ayahs)) {
          loaded = j;
          break;
        }
      }

      // Fallback: legacy per-ayah path if someone has that layout locally
      if (!loaded) {
        const legacyUrl = `${BASE}/tafsir/en-tafsir-ibn-kathir/${surahId}/${ayahId}.json`;
        const legacy = await fetchJSON<TafsirPayload>(legacyUrl);
        const legacyHtml = (legacy?.html ?? legacy?.text ?? "").trim();
        if (legacyHtml) {
          const html = legacy?.html ? legacyHtml : legacyHtml.replace(/\n/g, "<br/>");
          tafsirCacheRef.current.set(cacheKey, html);
          setTafsirHtml(html);
          setTafsirLoading(false);
          return;
        }
      }

      if (!loaded) {
        setTafsirError("Couldn’t load tafsir for this surah.");
        return;
      }

      const ay = loaded.ayahs.find((a) => Number(a.ayah) === ayahId);
      if (!ay) {
        setTafsirError("No tafsir available for this ayah.");
        return;
      }

      const raw = (ay.html ?? ay.text ?? "").trim();
      if (!raw) {
        setTafsirError("No tafsir available for this ayah.");
        return;
      }

      const html = ay.html ? raw : raw.replace(/\n/g, "<br/>");
      tafsirCacheRef.current.set(cacheKey, html);
      setTafsirHtml(html);
    } catch {
      setTafsirError("Could not load tafsir. Check your file path.");
    } finally {
      setTafsirLoading(false);
    }
  };

  const abortRef = useRef<AbortController | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [cacheState, setCacheState] = useState<null | "HIT" | "MISS" | "BYPASS-NEW">(null);

  const handleExplainStream = async (regenerate = false) => {
    if (!verse) return;
    setExplanation("");
    setLoading(true);
    setCacheState(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const url = new URL("/explain-stream", API_BASE).toString();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        body: JSON.stringify({
          surah: surahId,
          ayah: ayahId,
          text: verse.arabic ?? "",
          translation: verse.english ?? "",
          options: { style: styleOpt, length: lengthEnabled ? lengthOpt : undefined },
          regenerate,
        }),
        signal: controller.signal,
      });

      const hdr = res.headers.get("X-Cache");
      if (hdr === "HIT" || hdr === "MISS" || hdr === "BYPASS-NEW") setCacheState(hdr);

      if (!res.ok) {
        const fallback = await res.text();
        setExplanation(fallback || "⚠️ Error fetching explanation.");
        setLoading(false);
        return;
      }

      if (!res.body) {
        const txt = await res.text();
        setExplanation(txt);
        setHasGenerated(true);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sawAny = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          if (chunk && !sawAny) {
            sawAny = true;
            setHasGenerated(true);
          }
          setExplanation((prev) => prev + chunk);
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("stream error", err);
        setExplanation((prev) => prev || "⚠️ Stream interrupted.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  if (loadingData) {
    return (
      <main className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
        <LoadingBlock label="Loading ayah…" />
      </main>
    );
  }

  if (dataError) {
    return (
      <main className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
        <ErrorBlock msg={dataError} />
      </main>
    );
  }

  if (!verse) {
    return (
      <main className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
        <EmptyBlock hint="That verse wasn’t found. Try another like 2:255." />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
      <Link
        href="/"
        className="font-brand text-5xl font-extrabold tracking-tight mb-8 hover:underline block text-center"
      >
        QuranScope
      </Link>

      <div className="mb-4">
        <BackButton />
      </div>

      <h1 className="font-brand text-3xl font-semibold mb-6">
        Surah {surahId} — Ayah {ayahId}
      </h1>

      <AyahCard
        noHover
        refStr={key}
        arabic={verse.arabic || ""}
        translation={verse.english || ""}
        themes={themes}
        clampTranslation={false}
      />

      <div className="mt-3 p-3 bg-gray-50 rounded-2xl border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <button
            className="h-11 w-full px-4 rounded-xl bg-white shadow-sm border border-gray-200 hover:bg-gray-50"
            onClick={handleToggleTafsir}
            disabled={tafsirLoading}
          >
            {openTafsir ? "Hide Tafsir" : tafsirLoading ? "Loading…" : "View Tafsir"}
          </button>

          <button
            className="h-11 w-full px-4 rounded-xl bg-white shadow-sm border border-gray-200 hover:bg-gray-50"
            onClick={() => {
              setShowExplainOpts((v) => {
                const next = !v;
                if (next) {
                  setOpenTafsir(false);
                  setTafsirHtml(null);
                  setTafsirError(null);
                }
                return next;
              });
            }}
          >
            {showExplainOpts ? "Hide Options" : "Explain with AI"}
          </button>

          <CopyLink surahId={surahId} ayahId={ayahId} />

          <Link
            href={`/surah/${surahId}#ayah-${ayahId}`}
            className="h-11 w-full px-4 rounded-xl bg-white shadow-sm border border-gray-200 hover:bg-gray-50 flex items-center justify-center"
          >
            Jump to Surah →
          </Link>
        </div>
      </div>

      {openTafsir && (
        <div className="mt-4 p-4 bg-gray-50 text-sm rounded-2xl border border-gray-200 shadow-sm">
          {tafsirLoading && <LoadingBlock label="Loading tafsir…" />}
          {!tafsirLoading && tafsirError && <ErrorBlock msg={tafsirError} />}
          {!tafsirLoading && tafsirHtml && <div dangerouslySetInnerHTML={{ __html: tafsirHtml }} />}
          {!tafsirLoading && !tafsirError && !tafsirHtml && <EmptyBlock hint="No tafsir available for this ayah." />}
        </div>
      )}

      {showExplainOpts && (
        <div className="mt-3 border border-gray-200 rounded-2xl bg-gray-50 p-4 shadow-sm">
          <div className="text-sm font-medium mb-2">Explain options</div>

          <div className="flex flex-wrap gap-2 mb-3">
            {(
              ["balanced", "tldr", "bullets", "study", "youth", "reflection", "linguistic", "context"] as const
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyleOpt(s)}
                className={[
                  "text-sm px-3 py-1.5 rounded-md border transition",
                  styleOpt === s
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
                ].join(" ")}
              >
                {s === "tldr" ? "TL;DR" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            {!hasGenerated ? (
              <button
                type="button"
                onClick={() => handleExplainStream(false)}
                className="h-11 w-full px-4 rounded-xl bg-white shadow-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Streaming…" : "Generate"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleExplainStream(true)}
                className="h-11 w-full px-4 rounded-xl bg-white shadow-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                disabled={loading}
              >
                Refresh
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (loading) {
                  handleStop();
                } else {
                  setExplanation("");
                  setHasGenerated(false);
                  setCacheState(null);
                }
              }}
              className="h-11 w-full px-4 rounded-xl bg-white shadow-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Stop" : "Clear"}
            </button>

            <button
              type="button"
              onClick={() => {
                handleStop();
                setShowExplainOpts(false);
                setExplanation("");
                setHasGenerated(false);
                setCacheState(null);
              }}
              className="h-11 w-full px-4 rounded-xl bg-white shadow-sm border border-gray-200 hover:bg-gray-50"
            >
              Close
            </button>
          </div>

          {cacheState && (
            <div className="mt-1 text-xs text-gray-500">
              Source: {cacheState === "HIT" ? "Cache" : cacheState === "MISS" ? "Fresh" : "Forced fresh"}
            </div>
          )}

          {loading && !explanation && (
            <div className="mt-4 space-y-2" aria-hidden="true">
              <div className="h-3 bg-gray-200 rounded animate-pulse w-5/6" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-4/6" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-3/6" />
            </div>
          )}

          {explanation && (
            <div className="mt-4 p-4 bg-blue-50 text-base leading-7 rounded-2xl text-blue-800 whitespace-pre-line border border-blue-100">
              {explanation}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function CopyLink({ surahId, ayahId }: { surahId: number; ayahId: number }) {
  const [copied, setCopied] = useState(false);
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/ayah/${surahId}-${ayahId}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const el = document.createElement("textarea");
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopyLink}
      className={[
        "h-11 w-full px-4 rounded-xl shadow-sm",
        copied ? "border border-green-500 bg-green-50" : "border border-gray-200 bg-white hover:bg-gray-50",
      ].join(" ")}
    >
      {copied ? "Copied!" : "Copy Link"}
    </button>
  );
}
