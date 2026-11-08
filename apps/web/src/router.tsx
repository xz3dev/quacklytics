import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

/**
 * Plain URLSearchParams semantics: values stay strings and repeated keys stay
 * repeated. The router writes the serialized search back to the address bar on
 * load, and the OAuth login and consent pages must keep their signed query
 * exactly as received, which JSON-typed search params would rewrite.
 */
function parseSearch(search: string) {
  const values: Record<string, string | string[]> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    const previous = values[key];
    values[key] =
      previous === undefined
        ? value
        : Array.isArray(previous)
          ? [...previous, value]
          : [previous, value];
  }
  return values;
}
function stringifySearch(search: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search))
    for (const item of Array.isArray(value) ? value : [value])
      if (item !== undefined) params.append(key, String(item));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function getRouter() {
  return createRouter({
    routeTree,
    context: {
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: 1 } },
      }),
    },
    parseSearch,
    stringifySearch,
    scrollRestoration: true,
  });
}
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
