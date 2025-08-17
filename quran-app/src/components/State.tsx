"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-foreground ${className}`}
    />
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function EmptyBlock({ hint }: { hint: string }) {
  return <div className="p-6 text-sm text-muted-foreground">{hint}</div>;
}

export function ErrorBlock({ msg }: { msg: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3 p-6">
      <div className="text-sm text-red-600">{msg}</div>
      <button
        onClick={() => startTransition(() => router.refresh())}
        className="inline-flex h-11 items-center gap-2 rounded-xl border px-4"
        disabled={isPending}
      >
        {isPending && <Spinner />}
        <span>{isPending ? "Retrying…" : "Try again"}</span>
      </button>
    </div>
  );
}

export function SkeletonLines({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 w-full animate-pulse rounded bg-muted"
          style={{ width: `${80 - i * 6}%` }}
        />
      ))}
    </div>
  );
}
