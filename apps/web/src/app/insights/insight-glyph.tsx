import type { InsightType } from "@/model/insights/insight";

// Decorative type illustrations, deliberately not previews of query results.
export function InsightGlyph({
  type,
  compact = false,
}: {
  type: InsightType;
  compact?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center text-chart-1 ${compact ? "h-full w-full p-1" : "h-20 w-24"}`}
    >
      <svg
        viewBox="0 0 100 64"
        className={compact ? "h-full w-full" : "h-16 w-20"}
        fill="none"
      >
        {type === "Trend" && (
          <path
            d="M4 44 18 33 30 48 43 21 55 34 67 25 80 36 96 9"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {(type === "Value" || type === "Breakdown") &&
          [24, 38, 30, 49, 35, 43].map((height, i) => (
            <rect
              key={i}
              x={7 + i * 15}
              y={58 - height}
              width="8"
              height={height}
              rx="1.5"
              fill="currentColor"
              opacity={0.3 + i * 0.12}
            />
          ))}
        {type === "Funnel" && (
          <g fill="currentColor">
            <path d="M10 10h80L78 26H22Z" opacity=".8" />
            <path d="M25 32h50L64 46H36Z" opacity=".55" />
            <path d="M39 52h22l-7 10h-8Z" opacity=".3" />
          </g>
        )}
        {type === "Retention" &&
          [0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3, 4]
              .filter((col) => col < 5 - row)
              .map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={10 + col * 17}
                  y={4 + row * 15}
                  width="13"
                  height="11"
                  rx="2"
                  fill="currentColor"
                  opacity={0.2 + (row + col) * 0.1}
                />
              )),
          )}
        {type === "Path" && (
          <g stroke="currentColor" strokeWidth="2">
            <path d="M17 32h24m0 0V12h35M41 32v20h35" opacity=".5" />
            <rect
              x="5"
              y="23"
              width="20"
              height="18"
              rx="4"
              fill="currentColor"
            />
            <rect
              x="73"
              y="4"
              width="20"
              height="16"
              rx="4"
              fill="currentColor"
              opacity=".6"
            />
            <rect
              x="73"
              y="44"
              width="20"
              height="16"
              rx="4"
              fill="currentColor"
              opacity=".3"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
