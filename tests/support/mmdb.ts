// Writes a minimal IPv4 MaxMind DB mapping networks to countries, so GeoIP
// enrichment can be tested without downloading a real database.
type TreeRecord = { node: number } | { data: number } | undefined;

const bytes = (...values: number[]) => Uint8Array.from(values);
const unsigned = (value: number | bigint) => {
  const out: number[] = [];
  for (let rest = BigInt(value); rest > 0n; rest >>= 8n)
    out.unshift(Number(rest & 0xffn));
  return out;
};
const control = (type: number, size: number) =>
  type < 8 ? bytes((type << 5) | size) : bytes(size, type - 7);
type Value = string | number | bigint | Value[] | { [key: string]: Value };
function encode(value: Value, type?: "uint16" | "uint32" | "uint64"): number[] {
  if (typeof value === "string") {
    const text = new TextEncoder().encode(value);
    return [...control(2, text.length), ...text];
  }
  if (typeof value === "number" || typeof value === "bigint") {
    const payload = unsigned(value);
    const code = { uint16: 5, uint32: 6, uint64: 9 }[type ?? "uint32"];
    return [...control(code, payload.length), ...payload];
  }
  if (Array.isArray(value))
    return [
      ...control(11, value.length),
      ...value.flatMap((item) => encode(item)),
    ];
  const entries = Object.entries(value);
  return [
    ...control(7, entries.length),
    ...entries.flatMap(([key, item]) => [
      ...encode(key),
      ...encode(
        item,
        key === "build_epoch"
          ? "uint64"
          : ["record_size", "ip_version"].includes(key) ||
              key.startsWith("binary_format")
            ? "uint16"
            : "uint32",
      ),
    ]),
  ];
}

export function countryDatabase(networks: Record<string, string>) {
  const nodes: [TreeRecord, TreeRecord][] = [[undefined, undefined]];
  const data: number[] = [];
  for (const [cidr, country] of Object.entries(networks)) {
    const [address = "", bits = "32"] = cidr.split("/");
    const ip = address
      .split(".")
      .reduce((total, octet) => (total << 8) | Number(octet), 0);
    const offset = data.length;
    data.push(...encode({ country: { iso_code: country } }));
    let node = 0;
    for (let depth = 0; depth < Number(bits); depth++) {
      const side = (ip >>> (31 - depth)) & 1;
      const pair = nodes[node];
      if (!pair) throw new Error("Corrupt tree");
      if (depth === Number(bits) - 1) {
        pair[side] = { data: offset };
        break;
      }
      const next = pair[side];
      if (next && "node" in next) node = next.node;
      else {
        nodes.push([undefined, undefined]);
        node = nodes.length - 1;
        pair[side] = { node };
      }
    }
  }
  const count = nodes.length;
  const record = (value: TreeRecord) => {
    const number = !value
      ? count
      : "node" in value
        ? value.node
        : count + 16 + value.data;
    return [(number >> 16) & 0xff, (number >> 8) & 0xff, number & 0xff];
  };
  const marker = [0xab, 0xcd, 0xef, ...new TextEncoder().encode("MaxMind.com")];
  return Uint8Array.from([
    ...nodes.flatMap(([left, right]) => [...record(left), ...record(right)]),
    ...new Array<number>(16).fill(0),
    ...data,
    ...marker,
    ...encode({
      node_count: count,
      record_size: 24,
      ip_version: 4,
      database_type: "Test-Country",
      languages: ["en"],
      binary_format_major_version: 2,
      binary_format_minor_version: 0,
      build_epoch: 0,
      description: { en: "Quacklytics test database" },
    }),
  ]);
}
