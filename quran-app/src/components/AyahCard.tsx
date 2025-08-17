"use client";

import Link from "next/link";
import * as React from "react";
import ThemeChip from "@/components/ThemeChip";
import { uthmani } from "@/app/arabicFont";

type Props = {
  refStr: string;
  arabic: string;
  translation: string;
  themes?: string[];
  href?: string;
  highlightTerm?: string;
  noHover?: boolean;
  actions?: React.ReactNode;
  flash?: boolean;
  clampTranslation?: boolean;
};

export default function AyahCard({
  refStr,
  arabic,
  translation,
  themes = [],
  href,
  highlightTerm,
  noHover,
  actions,
  flash,
  clampTranslation = true,
}: Props) {
  const Container: any = href ? Link : "div";
  const containerProps = href ? { href } : {};

  return (
    <Container
      {...containerProps}
      className={[
        "block w-full rounded-2xl border bg-white/60 backdrop-blur transition",
        "border-gray-200 shadow-sm",
        noHover ? "" : "hover:bg-blue-50 hover:shadow-md hover:border-gray-300",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        "max-w-full overflow-hidden",
        "transition-[background-color,border-color,box-shadow] duration-300",
        flash ? "!bg-blue-50" : "",
      ].join(" ")}
      data-ref={refStr}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 break-words">{refStr}</h3>
          {themes.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {themes.slice(0, 6).map((t) => (
                <ThemeChip key={t} theme={t} />
              ))}
              {themes.length > 6 && (
                <span className="text-[11px] text-gray-500">+{themes.length - 6} more</span>
              )}
            </div>
          )}
        </div>

        {actions ? <div className="hidden sm:flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:pb-4">
        {arabic ? (
          <p
            dir="rtl"
            lang="ar"
            className={[uthmani.className, "text-2xl sm:text-3xl leading-[2] text-gray-900"].join(" ")}
          >
            {arabic}
          </p>
        ) : null}

        {translation ? (
          <p
            className={[
              "text-sm sm:text-base text-gray-700",
              "break-words [word-break:break-word] hyphens-auto",
              clampTranslation ? "line-clamp-4 sm:line-clamp-3" : "",
            ].join(" ")}
          >
            <Highlighted text={translation} term={highlightTerm} />
          </p>
        ) : null}

        {actions ? <div className="sm:hidden mt-1 grid grid-cols-1 gap-2">{actions}</div> : null}
      </div>
    </Container>
  );
}

function Highlighted({ text, term }: { text: string; term?: string }) {
  if (!term) return <>{text}</>;
  const q = term.trim();
  if (!q) return <>{text}</>;
  try {
    const re = new RegExp(escapeRegExp(q), "ig");
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (start > lastIndex) parts.push(text.slice(lastIndex, start));
      parts.push(
        <mark key={`${start}-${end}`} className="rounded px-0.5 bg-yellow-200/70">
          {text.slice(start, end)}
        </mark>
      );
      lastIndex = end;
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return <>{parts}</>;
  } catch {
    return <>{text}</>;
  }
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
