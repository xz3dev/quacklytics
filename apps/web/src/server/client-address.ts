import { BlockList, isIP } from "node:net";
import type { ProxyCheck } from "@quacklytics/contracts";

const PRESETS: Record<string, string[]> = {
  loopback: ["127.0.0.0/8", "::1/128"],
  private: [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "100.64.0.0/10",
    "fc00::/7",
  ],
};
const family = (address: string) => (isIP(address) === 6 ? "ipv6" : "ipv4");
const normalize = (address: string) =>
  address.toLowerCase().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, "");

/**
 * Parses `TRUSTED_PROXIES`: comma-separated IPs, CIDRs, or the presets
 * `loopback` and `private`. Unset means no proxy is trusted.
 */
export function trustedProxies(config = process.env.TRUSTED_PROXIES ?? "") {
  const entries = config
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => PRESETS[entry] ?? [entry]);
  if (!entries.length) return undefined;
  const list = new BlockList();
  for (const entry of entries) {
    const [address = "", prefix] = entry.split("/");
    const kind = isIP(address);
    const bits = prefix === undefined ? undefined : Number(prefix);
    if (
      !kind ||
      (bits !== undefined &&
        (!Number.isInteger(bits) || bits < 0 || bits > (kind === 6 ? 128 : 32)))
    )
      throw new Error(`Invalid TRUSTED_PROXIES entry: ${entry}`);
    if (bits === undefined) list.addAddress(address, family(address));
    else list.addSubnet(address, bits, family(address));
  }
  return list;
}

function forwardedHop(value: string): string | undefined {
  const hop = value.trim();
  const address =
    /^\[([^\]]+)\](?::\d+)?$/.exec(hop)?.[1] ??
    /^(\d+\.\d+\.\d+\.\d+):\d+$/.exec(hop)?.[1] ??
    hop;
  return isIP(address) ? normalize(address) : undefined;
}

/**
 * The client is the nearest address not belonging to a trusted proxy. Hops are
 * read right to left, so entries a client prepends to X-Forwarded-For are
 * ignored unless every proxy in between is trusted.
 */
export function clientAddress(
  socket: string,
  forwardedFor: string | null,
  trusted: BlockList | undefined,
) {
  return resolveClient(socket, forwardedFor, trusted).address;
}

/** Also reports how many forwarded hops remain left of the client. */
function resolveClient(
  socket: string,
  forwardedFor: string | null,
  trusted: BlockList | undefined,
) {
  let address = normalize(socket);
  if (!trusted || !forwardedFor) return { address, remaining: 0 };
  const hops = forwardedFor.split(",");
  for (let index = hops.length - 1; index >= 0; index--) {
    if (!trusted.check(address, family(address)))
      return { address, remaining: index + 1 };
    const hop = forwardedHop(hops[index] ?? "");
    if (!hop) return { address, remaining: index + 1 };
    address = hop;
  }
  return { address, remaining: 0 };
}

const presetOf = (address: string) =>
  Object.entries(PRESETS).find(([, ranges]) => {
    const list = new BlockList();
    for (const range of ranges) {
      const [base = "", bits = ""] = range.split("/");
      list.addSubnet(base, Number(bits), family(base));
    }
    return list.check(address, family(address));
  })?.[0];
const isLocalHost = (host: string) => {
  const name = host.replace(/^\[|\](?::\d+)?$|:\d+$/g, "");
  return name === "localhost" || name.endsWith(".localhost") || !!isIP(name);
};

/**
 * Diagnoses whether `TRUSTED_PROXIES` lets the server see real visitors.
 * Behind a proxy the socket peer is the proxy, so it must be trusted and must
 * forward X-Forwarded-For; any further private hop is another proxy to trust.
 */
export function proxyCheck({
  socket,
  forwardedFor,
  host,
  config = process.env.TRUSTED_PROXIES ?? "",
}: {
  socket: string;
  forwardedFor: string | null;
  host: string | null;
  config?: string;
}): ProxyCheck {
  const trusted = trustedProxies(config);
  const socketIp = normalize(socket);
  const { address, remaining } = resolveClient(socket, forwardedFor, trusted);
  const configured = config.trim() || null;
  const extend = (address: string) => {
    const entry = presetOf(address) ?? address;
    return configured ? `${configured},${entry}` : entry;
  };
  const result = (status: ProxyCheck["status"], suggestion: string | null) => ({
    status,
    clientIp: address,
    socketIp,
    forwardedFor,
    trustedProxies: configured,
    suggestion,
  });
  const trustsSocket = !!trusted?.check(socketIp, family(socketIp));
  if (!forwardedFor?.trim()) {
    // A trusted peer, or a local peer reached through a hostname on the default
    // port, is a proxy that does not forward the visitor's address.
    const proxied =
      trustsSocket ||
      (!!presetOf(socketIp) &&
        !!host &&
        !isLocalHost(host) &&
        !/:\d+$/.test(host));
    return result(proxied ? "missing-header" : "direct", null);
  }
  if (!trustsSocket) return result("untrusted", extend(socketIp));
  if (
    remaining &&
    presetOf(address) &&
    !trusted?.check(address, family(address))
  )
    return result("partial", extend(address));
  return result("ok", null);
}
