import { z } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request(
  method: string,
  url: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch("/api/" + url.replace(/^\//, ""), {
    method,
    ...(signal ? { signal } : {}),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = z
      .object({ error: z.string().optional(), message: z.string().optional() })
      .safeParse(value);
    throw new HttpError(
      response.status,
      error.success
        ? (error.data.error ?? error.data.message ?? "Request failed")
        : "Request failed",
    );
  }
  return value;
}
const get = async <T>(
  url: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
) => schema.parse(await request("GET", url, undefined, signal));
const post = async <T>(url: string, body: unknown, schema: z.ZodType<T>) =>
  schema.parse(await request("POST", url, body));
const put = async <T>(url: string, body: unknown, schema: z.ZodType<T>) =>
  schema.parse(await request("PUT", url, body));
const del = async (url: string) => {
  await request("DELETE", url);
};
export const http = { get, post, put, del };
