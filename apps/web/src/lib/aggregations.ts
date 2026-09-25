export const aggregationFunctions = [
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
] as const;

export type AggregationFunction = (typeof aggregationFunctions)[number];
export const isNumericAggregation = (agg: AggregationFunction) =>
  agg !== "COUNT";

// Interface for an aggregation function
export type Aggregation = import("zod").infer<
  typeof import("@quacklytics/contracts").aggregation
>;
