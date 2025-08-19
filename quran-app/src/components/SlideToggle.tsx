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
      className="relative inline-flex rounded-full bg-gray-200/80 p-1 shadow-inner"
    >
      {/* Sliding indicator */}
      <div
  aria-hidden="true"
  className="absolute rounded-full bg-white transition-all duration-300 ease-out inset-y-0.5"
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
