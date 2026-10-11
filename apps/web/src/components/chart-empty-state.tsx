import { useId } from "react";
import type { Insight } from "@/model/insights/insight";
import { ChartEmptyMap } from "./chart-empty-map";
import { ChartSpace } from "./chart-space";

// Illustration-only fixtures: never enter query results, tooltips, or exports.
const sampleTrend = [32, 48, 39, 72, 57, 84, 69, 104, 91, 124, 110, 146];
const sampleBars = [152, 112, 78, 49];
const samplePaths = [
  { source: "Home", target: "Explore", value: 84, distance: 1 },
  { source: "Home", target: "Details", value: 52, distance: 2 },
  { source: "Home", target: "Sign up", value: 31, distance: 3 },
];
const sampleRetention = [
  [1, 0.72, 0.53, 0.42, 0.34, 0.29],
  [1, 0.65, 0.49, 0.38, 0.3],
  [1, 0.78, 0.61, 0.45],
  [1, 0.7, 0.51],
  [1, 0.76],
];

export function ChartEmptyState({ insight }: { insight: Insight }) {
  const patternId = `preview-${useId().replace(/:/g, "")}`;
  const kind = insight.type;
  const unconfigured =
    kind === "Funnel" && !insight.config.funnel.steps?.length;
  const visualisations =
    kind === "Trend"
      ? (insight.config.trend.series ?? []).map(
          (series) => series.visualisation,
        )
      : [];
  const bars = kind === "Trend" && visualisations.includes("bar");
  const line =
    kind === "Trend" &&
    (visualisations.includes("line") || !visualisations.length);
  const fill = `url(#${patternId})`;
  return (
    <ChartSpace minimum={176}>
      {(height) => (
        <div
          role="img"
          aria-label={`${kind} chart preview. Illustrative sample only; no matching results.${unconfigured ? " Add funnel steps to begin." : ""}`}
          data-chart-preview={kind}
          className="flex h-full min-w-0 flex-col"
        >
          <div
            className="flex min-h-0 flex-1 items-center justify-center py-3"
            aria-hidden="true"
          >
            <svg
              viewBox={kind === "Path" ? "0 0 480 310" : "0 0 480 230"}
              className="w-full text-muted-foreground"
              style={{ maxHeight: Math.min(360, height - 60) }}
              fill="none"
            >
              <defs>
                <pattern
                  id={patternId}
                  width="7"
                  height="7"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(35)"
                >
                  <rect
                    width="7"
                    height="7"
                    fill="currentColor"
                    fillOpacity="0.06"
                  />
                  <path
                    d="M 0 0 V 7"
                    stroke="currentColor"
                    strokeOpacity="0.25"
                    strokeWidth="2"
                  />
                </pattern>
              </defs>
              {(kind === "Trend" || kind === "Funnel") && (
                <g stroke="currentColor" strokeOpacity="0.15">
                  {[40, 90, 140, 190].map((y) => (
                    <path key={y} d={`M 30 ${y} H 458`} strokeDasharray="3 6" />
                  ))}
                  <path d="M 30 24 V 190 H 458" />
                </g>
              )}
              {kind === "Trend" && (
                <>
                  {bars &&
                    sampleTrend.map((value, index) => (
                      <rect
                        key={index}
                        x={38 + index * 35}
                        y={190 - value}
                        width="22"
                        height={value}
                        rx="3"
                        fill={fill}
                        stroke="currentColor"
                        strokeOpacity="0.3"
                        strokeDasharray="3 3"
                      />
                    ))}
                  {line && (
                    <polyline
                      points={sampleTrend
                        .map(
                          (value, index) => `${40 + index * 37},${190 - value}`,
                        )
                        .join(" ")}
                      stroke="currentColor"
                      strokeOpacity="0.45"
                      strokeWidth="3"
                      strokeDasharray="6 5"
                      strokeLinejoin="round"
                    />
                  )}
                  {["Start", "Middle", "Now"].map((label, index) => (
                    <text
                      key={label}
                      x={40 + index * 194}
                      y="218"
                      fill="currentColor"
                      fillOpacity="0.55"
                      fontSize="12"
                    >
                      {label}
                    </text>
                  ))}
                </>
              )}
              {kind === "Funnel" &&
                sampleBars.map((value, index) => (
                  <g key={index}>
                    <rect
                      x={38 + index * 107}
                      y="30"
                      width="94"
                      height="160"
                      rx="4"
                      fill={fill}
                      fillOpacity="0.2"
                      stroke="currentColor"
                      strokeOpacity="0.16"
                      strokeDasharray="4 4"
                    />
                    <rect
                      x={38 + index * 107}
                      y={190 - value}
                      width="94"
                      height={value}
                      rx="4"
                      fill={fill}
                      stroke="currentColor"
                      strokeOpacity="0.35"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={85 + index * 107}
                      y="216"
                      textAnchor="middle"
                      fill="currentColor"
                      fillOpacity="0.55"
                      fontSize="12"
                    >
                      Step {index + 1}
                    </text>
                  </g>
                ))}
              {kind === "Breakdown" &&
                sampleBars.map((value, index) => (
                  <g key={index}>
                    <text
                      x="104"
                      y={49 + index * 49}
                      textAnchor="end"
                      fill="currentColor"
                      fillOpacity="0.55"
                      fontSize="12"
                    >
                      Category {index + 1}
                    </text>
                    <rect
                      x="122"
                      y={29 + index * 49}
                      width="330"
                      height="30"
                      rx="4"
                      fill="currentColor"
                      fillOpacity="0.035"
                    />
                    <rect
                      x="122"
                      y={29 + index * 49}
                      width={value * 2}
                      height="30"
                      rx="4"
                      fill={fill}
                      stroke="currentColor"
                      strokeOpacity="0.3"
                      strokeDasharray="4 4"
                    />
                  </g>
                ))}
              {kind === "Retention" && (
                <>
                  {[0, 1, 2, 3, 4, 5].map((period) => (
                    <text
                      key={period}
                      x={145 + period * 55}
                      y="20"
                      textAnchor="middle"
                      fill="currentColor"
                      fillOpacity="0.55"
                      fontSize="12"
                    >
                      P{period}
                    </text>
                  ))}
                  {sampleRetention.map((periods, row) => (
                    <g key={row}>
                      <text
                        x="104"
                        y={55 + row * 38}
                        textAnchor="end"
                        fill="currentColor"
                        fillOpacity="0.55"
                        fontSize="12"
                      >
                        Cohort {row + 1}
                      </text>
                      {periods.map((value, column) => (
                        <g key={column}>
                          <rect
                            x={120 + column * 55}
                            y={33 + row * 38}
                            width="49"
                            height="32"
                            rx="3"
                            fill="currentColor"
                            fillOpacity={value * 0.22}
                          />
                          <rect
                            x={120 + column * 55}
                            y={33 + row * 38}
                            width="49"
                            height="32"
                            rx="3"
                            fill={fill}
                            stroke="currentColor"
                            strokeOpacity="0.2"
                            strokeDasharray="3 3"
                          />
                        </g>
                      ))}
                    </g>
                  ))}
                </>
              )}
              {kind === "Map" && <ChartEmptyMap fill={fill} />}
              {kind === "Path" && (
                <>
                  <g stroke="currentColor" strokeOpacity="0.15">
                    {[30, 70, 110].map((y) => (
                      <path
                        key={y}
                        d={`M 30 ${y} H 450`}
                        strokeDasharray="3 6"
                      />
                    ))}
                    <path d="M 30 18 V 110 H 450" />
                  </g>
                  {samplePaths.map((path, index) => (
                    <g key={path.target}>
                      <rect
                        x={84 + index * 140}
                        y={110 - path.value}
                        width="28"
                        height={path.value}
                        rx="3"
                        fill={fill}
                        stroke="currentColor"
                        strokeOpacity="0.3"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={98 + index * 140}
                        y="132"
                        textAnchor="middle"
                        fill="currentColor"
                        fillOpacity="0.55"
                        fontSize="11"
                      >
                        {path.source} → {path.target}
                      </text>
                      <text
                        x="30"
                        y={170 + index * 51}
                        fill="currentColor"
                        fillOpacity="0.55"
                        fontSize="13"
                      >
                        {path.source} → {path.target}
                      </text>
                      <text
                        x="450"
                        y={170 + index * 51}
                        textAnchor="end"
                        fill="currentColor"
                        fillOpacity="0.4"
                        fontSize="11"
                      >
                        {path.distance} {path.distance === 1 ? "step" : "steps"}{" "}
                        {insight.config.path.direction === "backward"
                          ? "before"
                          : "after"}
                      </text>
                      <rect
                        x="30"
                        y={182 + index * 51}
                        width="420"
                        height="8"
                        rx="4"
                        fill="currentColor"
                        fillOpacity="0.06"
                      />
                      <rect
                        x="30"
                        y={182 + index * 51}
                        width={path.value * 5}
                        height="8"
                        rx="4"
                        fill={fill}
                        stroke="currentColor"
                        strokeOpacity="0.3"
                        strokeDasharray="4 4"
                      />
                    </g>
                  ))}
                </>
              )}
              {kind === "Value" && (
                <>
                  <text
                    x="30"
                    y="77"
                    fill="currentColor"
                    fillOpacity="0.28"
                    fontSize="64"
                    fontWeight="600"
                  >
                    1,240
                  </text>
                  {[
                    { label: "Current period", width: 405 },
                    { label: "Previous period", width: 290 },
                  ].map((entry, index) => (
                    <g key={entry.label}>
                      <text
                        x="30"
                        y={114 + index * 65}
                        fill="currentColor"
                        fillOpacity="0.55"
                        fontSize="13"
                      >
                        {entry.label}
                      </text>
                      <rect
                        x="30"
                        y={129 + index * 65}
                        width="420"
                        height="12"
                        rx="6"
                        fill="currentColor"
                        fillOpacity="0.06"
                      />
                      <rect
                        x="30"
                        y={129 + index * 65}
                        width={entry.width}
                        height="12"
                        rx="6"
                        fill={fill}
                        stroke="currentColor"
                        strokeOpacity="0.3"
                        strokeDasharray="4 4"
                      />
                    </g>
                  ))}
                </>
              )}
            </svg>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            {unconfigured ? "Add steps to build your funnel." : "No data yet"}
          </p>
        </div>
      )}
    </ChartSpace>
  );
}
