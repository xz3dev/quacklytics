import { z } from "zod";
import { resultRow, storedEvent, parseJson } from "@quacklytics/contracts";
import { createDb } from "@/client/analytics/database.ts";
import {
  DuckDBDataProtocol,
  type AsyncDuckDB,
  type AsyncDuckDBConnection,
} from "@duckdb/duckdb-wasm";
import { AnalyticsEvent } from "@/model/event.ts";
import type { QueryParamValue } from "@lib/queries.ts";
import type {
  FileMetadata,
  AnalyticsSnapshot,
} from "@/client/api/analytics.ts";
import { createLoadStore } from "@/client/analytics/load-state.ts";
import { createDuckDbFileManager } from "@/client/analytics/files.ts";
import { QueryClient } from "@tanstack/react-query";

export class DuckDbManager {
  private closed = false;
  private lifetime = new AbortController();
  private files = new Map<string, { file: FileMetadata; alias: string }>();
  private snapshotRevision: number | undefined;
  private operations: Promise<unknown> = Promise.resolve();
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operations.then(() => {
      this.lifetime.signal.throwIfAborted();
      return untilAborted(operation(), this.lifetime.signal);
    });
    this.operations = next.catch(() => undefined);
    return next;
  }
  private db: Promise<AsyncDuckDB | null> | undefined;
  private conn: Promise<AsyncDuckDBConnection> | undefined;
  private initialization: Promise<void> | undefined;
  loadState = createLoadStore();
  readonly fileManager;

  constructor(
    readonly projectId: string,
    queryClient: QueryClient,
  ) {
    this.fileManager = createDuckDbFileManager(projectId, this, queryClient);
  }

  start(): Promise<void> {
    this.lifetime.signal.throwIfAborted();
    if (this.initialization) return this.initialization;
    this.loadState.getState().setError(null);
    this.db = createDb();
    this.conn = this.db.then(async (db) => {
      if (!db) throw new Error("Database initialization failed");
      const conn = await untilAborted(db.connect(), this.lifetime.signal);
      try {
        await untilAborted(this.setupView(conn), this.lifetime.signal);
        return conn;
      } catch (error) {
        if (!this.closed) await conn.close();
        throw error;
      }
    });
    this.initialization = this.conn
      .then(() => {
        this.lifetime.signal.throwIfAborted();
        this.loadState.getState().finishInit();
        this.fileManager.start();
      })
      .catch(async (error: unknown) => {
        const db = await this.db?.catch(() => null);
        if (!this.closed) await db?.terminate();
        this.initialization = undefined;
        if (!this.closed)
          this.loadState
            .getState()
            .setError(
              error instanceof Error
                ? error.message
                : "Database initialization failed",
            );
        throw error;
      });
    return this.initialization;
  }

  async retry() {
    await this.start();
    await this.fileManager.loadData();
  }

  private async connection() {
    this.lifetime.signal.throwIfAborted();
    if (!this.conn) throw new Error("Database has not started");
    const conn = await this.conn;
    this.lifetime.signal.throwIfAborted();
    return conn;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    this.fileManager.close();
    this.lifetime.abort();

    // A prepared query can occupy the WASM worker without yielding to cancellation.
    // Terminate the project-owned worker rather than waiting for that query to finish.
    const db = await this.db?.catch(() => null);
    await db?.terminate();
  }

  async setupView(conn: AsyncDuckDBConnection) {
    await conn.query(`CREATE TABLE analytics_live(id VARCHAR,timestamp TIMESTAMP,
      event_type VARCHAR,session_id VARCHAR,person_id VARCHAR,properties JSON)`);
    await conn.query("CREATE VIEW events AS SELECT * FROM analytics_live");
  }

  async setSnapshot(snapshot: AnalyticsSnapshot): Promise<boolean> {
    const files = snapshot.files;
    return this.exclusive(async () => {
      if (this.closed) return false;
      const conn = await this.connection();
      const db = await this.db;
      if (!db) throw new Error("Database unavailable");
      const next = new Map<string, { file: FileMetadata; alias: string }>();
      const added: string[] = [];
      let changed =
        files.length !== this.files.size ||
        snapshot.committedRevision !== this.snapshotRevision;
      const liveAlias = `${crypto.randomUUID()}.json`;
      let transaction = false;
      try {
        for (const file of files) {
          const previous = this.files.get(file.partition);
          if (
            previous?.file.name === file.name &&
            Date.parse(previous.file.expiresAt) > Date.now() + 300_000
          ) {
            next.set(file.partition, previous);
            continue;
          }
          changed = true;
          const alias = `${crypto.randomUUID()}.parquet`;
          await db.registerFileURL(
            alias,
            file.url,
            DuckDBDataProtocol.HTTP,
            false,
          );
          added.push(alias);
          next.set(file.partition, { file, alias });
        }
        if (!changed) return false;
        await db.registerFileBuffer(
          liveAlias,
          new TextEncoder().encode(JSON.stringify(snapshot.liveEvents)),
        );
        await conn.query("BEGIN TRANSACTION");
        transaction = true;
        await conn.query("DELETE FROM analytics_live");
        if (snapshot.liveEvents.length)
          await conn.query(`INSERT INTO analytics_live SELECT id,epoch_ms(timestamp),event_type,session_id,person_id,properties
            FROM read_json(${sqlString(liveAlias)},format='array',columns={id:'VARCHAR',timestamp:'BIGINT',event_type:'VARCHAR',session_id:'VARCHAR',person_id:'VARCHAR',properties:'JSON'})`);
        if (next.size) {
          const paths = [...next.values()]
            .map((entry) => sqlString(entry.alias))
            .join(",");
          await conn.query(
            `CREATE OR REPLACE VIEW events AS SELECT * FROM read_parquet([${paths}]) UNION ALL SELECT * FROM analytics_live`,
          );
        } else {
          await conn.query(
            "CREATE OR REPLACE VIEW events AS SELECT * FROM analytics_live",
          );
        }
        await conn.query("COMMIT");
        transaction = false;
      } catch (error) {
        if (transaction) await conn.query("ROLLBACK");
        for (const alias of added)
          await db.dropFile(alias).catch(() => undefined);
        throw error;
      } finally {
        await db.dropFile(liveAlias).catch(() => undefined);
      }
      this.snapshotRevision = snapshot.committedRevision;
      const old = this.files;
      this.files = next;
      for (const [partition, entry] of old) {
        if (next.get(partition)?.alias !== entry.alias)
          await db
            .dropFile(entry.alias)
            .catch((error) =>
              console.warn("Unable to release retired object", error),
            );
      }
      return true;
    });
  }

  async runQuery(
    { sql, params }: { sql: string; params: QueryParamValue[] },
    signal?: AbortSignal,
  ) {
    const combined = signal
      ? AbortSignal.any([signal, this.lifetime.signal])
      : this.lifetime.signal;
    combined.throwIfAborted();
    await this.ensureFreshAccess();
    return this.exclusive(async () => {
      combined.throwIfAborted();
      const conn = await this.connection();
      const prepared = params.length
        ? await untilAborted(conn.prepare(sql), this.lifetime.signal)
        : undefined;
      let cancellation: Promise<boolean> | undefined;
      const cancel = () => {
        cancellation = conn.cancelSent().catch(() => false);
      };
      try {
        combined.throwIfAborted();
        combined.addEventListener("abort", cancel, { once: true });
        // The pending-query API yields between execution chunks. Parameterized
        // queries retain native bindings; their results are discarded on abort.
        const stream = await untilAborted(
          prepared ? prepared.send(...params) : conn.send(sql),
          this.lifetime.signal,
        );
        const rows: Record<string, unknown>[] = [];
        const iterator = stream[Symbol.asyncIterator]();
        while (true) {
          const batch = await untilAborted(
            iterator.next(),
            this.lifetime.signal,
          );
          if (batch.done) break;
          combined.throwIfAborted();
          rows.push(...arrowRows(batch.value));
        }
        combined.throwIfAborted();
        return z.array(resultRow).parse(rows);
      } finally {
        combined.removeEventListener("abort", cancel);
        if (!this.closed) {
          await untilAborted(
            Promise.resolve(cancellation),
            this.lifetime.signal,
          );
          if (prepared)
            await untilAborted(prepared.close(), this.lifetime.signal);
        }
      }
    });
  }

  async runEventsQuery(
    sql: string,
    params: QueryParamValue[] = [],
    signal?: AbortSignal,
  ) {
    return this.mapToEvents(await this.runQuery({ sql, params }, signal));
  }

  private async ensureFreshAccess() {
    if (
      [...this.files.values()].some(
        (entry) => Date.parse(entry.file.expiresAt) <= Date.now() + 60_000,
      )
    ) {
      const files = await this.fileManager.loadData();
      return files;
    }
  }

  mapToEvents(results: unknown[]): AnalyticsEvent[] {
    const raw = z.object({
      id: z.string(),
      event_type: z.string(),
      person_id: z.string().nullable(),
      session_id: z.string().nullable(),
      timestamp: z.union([z.number(), z.bigint()]),
      properties: z.string(),
    });
    return results.map((value) => {
      const row = raw.parse(value);
      return storedEvent.parse({
        id: row.id,
        eventType: row.event_type,
        personId: row.person_id,
        sessionId: row.session_id,
        timestamp: new Date(Number(row.timestamp)),
        properties: parseJson(row.properties),
      });
    });
  }
}
function sqlString(value: string) {
  return "'" + value.replaceAll("'", "''") + "'";
}

interface ArrowResult {
  numRows: number;
  schema: { fields: ReadonlyArray<{ name: string; type: unknown }> };
  getChild: (name: string) => { get: (index: number) => unknown } | null;
}
function arrowRows(table: ArrowResult) {
  const rows: Record<string, unknown>[] = [];
  for (let index = 0; index < table.numRows; index++) {
    const row: Record<string, unknown> = {};
    for (const field of table.schema.fields) {
      const value: unknown = table.getChild(field.name)?.get(index);
      row[field.name] = normalizeArrowValue(value, field.type);
    }
    rows.push(row);
  }
  return rows;
}

function normalizeArrowValue(value: unknown, type: unknown): unknown {
  if (value instanceof Uint32Array && Symbol.for("isArrowBigNum") in value) {
    const decimal = z.object({ scale: z.number().int() }).safeParse(type);
    const raw = value.toString();
    const scale = decimal.success ? decimal.data.scale : 0;
    if (scale <= 0) return raw + "0".repeat(-scale);
    const negative = raw.startsWith("-");
    const digits = (negative ? raw.slice(1) : raw).padStart(scale + 1, "0");
    return (
      (negative ? "-" : "") +
      digits.slice(0, -scale) +
      "." +
      digits.slice(-scale)
    );
  }
  return value;
}

function untilAborted<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () =>
      reject(new DOMException("Project closed", "AbortError"));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
