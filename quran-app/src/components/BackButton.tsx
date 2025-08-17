"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  label?: string;
  className?: string;
};

export default function BackButton({ label = "Back", className = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCanGoBack(window.history.length > 1);
    }
  }, [pathname]);

  const goBack = useCallback(() => {
    if (canGoBack) router.back();
    else router.push("/");
  }, [canGoBack, router]);

  if (pathname === "/") return null;

  return (
    <button
      onClick={goBack}
      className={
        className ||
        "mb-4 inline-flex items-center gap-2 rounded-2xl border border-gray-300 px-3 py-1.5 bg-[#fcf5e8] hover:bg-blue-50 shadow-sm hover:shadow-md"
      }
      aria-label="Go back"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}
