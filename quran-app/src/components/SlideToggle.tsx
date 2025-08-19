"use client";

export default function SlideToggle({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: any) => void;
  options: { label: string; value: string }[];
}) {
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const pct = 100 / options.length;

  return (
    <div
      role="tablist"
      aria-label="Search mode"
      className="relative inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm"
    >
      {/* Sliding indicator */}
      <div
  aria-hidden="true"
  className="absolute inset-y-0.5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-all duration-300 ease-out"
  style={{
    left: `${activeIndex * pct}%`,
    width: `${pct}%`,
  }}
/>


      {/* Buttons */}
      {options.map((opt, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={[
  "relative z-10 flex-1 px-5 py-1 text-sm font-medium rounded-full transition-colors whitespace-nowrap",
  active ? "text-gray-900" : "text-gray-600 hover:text-gray-800",
].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
