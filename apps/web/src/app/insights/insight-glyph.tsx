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
        {type === "Map" && (
          <g fill="currentColor">
            <path
              d="M8 18c6-8 20-10 28-5 4 3 2 9-3 11-3 1-4 5-8 7-5 2-10-1-12-5-3-3-7-4-5-8Z"
              opacity=".8"
            />
            <path
              d="M27 35c5-1 9 2 9 7 0 6-4 12-7 17-2-4-5-9-5-14 0-4 0-9 3-10Z"
              opacity=".45"
            />
            <path
              d="M46 14c6-5 18-6 28-4 9 2 18 6 19 12 0 5-6 7-11 8-3 4-9 4-13 2-4 3-9 1-11-3-5-2-15-9-12-15Z"
              opacity=".6"
            />
            <path
              d="M50 33c4-1 8 1 9 6 1 6-2 11-6 14-3-3-6-8-6-13 0-3 1-6 3-7Z"
              opacity=".3"
            />
            <path
              d="M78 44c4-2 10-1 12 3 1 4-3 7-8 7-4 0-7-2-7-5 0-2 1-4 3-5Z"
              opacity=".5"
            />
          </g>
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
