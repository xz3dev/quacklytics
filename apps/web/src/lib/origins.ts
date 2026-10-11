/**
 * Validates an allowed-origin entry: `*`, or a bare http(s) origin without a
 * path or trailing slash. Returns an error message, or null when valid.
 */
export function originError(origin: string, existing: string[]) {
  try {
    if (origin !== "*") {
      const url = new URL(origin);
      if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin)
        throw new Error("Invalid origin");
    }
  } catch {
    return "Enter an origin with a scheme and host, such as https://app.example.com, without a path or trailing slash.";
  }
  if (existing.includes(origin)) return "This origin is already allowed.";
  return null;
}
