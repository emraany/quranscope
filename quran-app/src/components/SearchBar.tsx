"use client";

import { useState } from "react";

type SearchBarProps = {
  onSearch: (query: string) => void;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
};

export default function SearchBar({
  onSearch,
  placeholder = "Search themes or keywords...",
  value,
  onChange,
}: SearchBarProps) {
  const isControlled = value !== undefined && typeof onChange === "function";
  const [internal, setInternal] = useState("");
  const current = isControlled ? value! : internal;

  const handleChange = (v: string) => {
    if (isControlled) onChange!(v);
    else setInternal(v);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = current.trim();
    if (q) onSearch(q);
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl mx-auto">
      <input
        type="text"
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="flex-grow px-4 py-2 bg-[#fcf5e8] rounded-l-md border border-gray-300 focus:outline-none"
        aria-label="Search"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-400 text-white rounded-r-md hover:bg-blue-500"
      >
        Search
      </button>
    </form>
  );
}
