import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Reader, type CountryResponse } from "mmdb-lib";

const DAY_MS = 24 * 60 * 60 * 1000;
const PROBE = { ip: "8.8.8.8", country: "US" };

function open(bytes: Uint8Array) {
  const reader = new Reader<CountryResponse>(
    Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  );
  // Rejects truncated or unrelated databases before they replace a working one.
  if (reader.get(PROBE.ip)?.country?.iso_code !== PROBE.country)
    throw new Error("GeoIP database failed its lookup probe");
  return reader;
}

const monthOf = (date: Date) => date.toISOString().slice(0, 7);

/** Where country lookups come from; DB-IP's licence requires crediting it in the UI. */
export function geoipSource({
  mode = process.env.GEOIP,
  path = process.env.GEOIP_DB_PATH,
}: { mode?: string | undefined; path?: string | undefined } = {}) {
  if (mode === "off") return "off";
  return path ? "custom" : "db-ip";
}

/**
 * Resolves visitor countries from a local MMDB database. By default it keeps
 * DB-IP's free country database (CC BY 4.0) in `DATA_DIR/geoip`, checking daily
 * for the monthly release. `GEOIP_DB_PATH` uses a provided file instead and
 * `GEOIP=off` disables lookups. Until a database is available, lookups miss.
 */
export function createGeoip({
  mode = process.env.GEOIP,
  path = process.env.GEOIP_DB_PATH,
  dataDir = resolve(process.env.DATA_DIR ?? "./data"),
}: { mode?: string; path?: string; dataDir?: string } = {}) {
  let reader: Reader<CountryResponse> | undefined;
  const country = (ip: string) => {
    try {
      const code = reader?.get(ip)?.country?.iso_code;
      return code && /^[A-Z]{2}$/.test(code) ? code : undefined;
    } catch {
      // IPv6 addresses cannot be looked up in IPv4-only databases.
      return undefined;
    }
  };
  const source = geoipSource({ mode, path });
  if (source === "off") return { country };
  if (path) {
    const file = path;
    void Bun.file(file)
      .bytes()
      .then((bytes) => {
        reader = open(bytes);
      })
      .catch((error: unknown) =>
        console.warn(`GeoIP: cannot load ${file}:`, error),
      );
    return { country };
  }
  const file = join(dataDir, "geoip", "dbip-country-lite.mmdb");
  let loadedMonth: string | undefined;
  async function refresh() {
    if (!reader) {
      const existing = await stat(file).catch(() => undefined);
      // A damaged file is replaced by the download below.
      if (existing)
        try {
          reader = open(await Bun.file(file).bytes());
          loadedMonth = monthOf(existing.mtime);
        } catch (error) {
          console.warn(`GeoIP: ignoring unreadable ${file}:`, error);
        }
    }
    const month = monthOf(new Date());
    if (loadedMonth === month) return;
    const response = await fetch(
      `https://download.db-ip.com/free/dbip-country-lite-${month}.mmdb.gz`,
    );
    // Each month's release appears during its first days; retry tomorrow.
    if (response.status === 404) return;
    if (!response.ok)
      throw new Error(`download failed with HTTP ${response.status}`);
    const bytes = Bun.gunzipSync(new Uint8Array(await response.arrayBuffer()));
    const next = open(bytes);
    await mkdir(dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    try {
      await Bun.write(temporary, bytes);
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
    reader = next;
    loadedMonth = month;
  }
  const update = () =>
    refresh().catch((error: unknown) =>
      console.warn("GeoIP: database update failed:", error),
    );
  void update();
  setInterval(update, DAY_MS).unref();
  return { country };
}
