export function toJSON(obj: unknown): string {
  return JSON.stringify(obj, (_, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}
