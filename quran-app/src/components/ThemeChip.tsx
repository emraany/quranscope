"use client";

import { useRouter } from "next/navigation";

export default function ThemeChip({
  theme,
  onClick,
}: {
  theme: string;
  onClick?: () => void;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onClick) {
          onClick();
        } else {
          router.push(`/theme/${encodeURIComponent(theme)}`);
        }
      }}
      className="rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 px-3 py-1 text-sm text-gray-700 whitespace-nowrap hover:from-indigo-200 hover:to-purple-200 transition"
      title={`Search theme: ${theme}`}
    >
      {theme}
    </button>
  );
}
