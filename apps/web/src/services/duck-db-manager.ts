import { z } from "zod";
import { resultRow, storedEvent, parseJson } from "@quacklytics/contracts";
import { createDb } from "@lib/duckdb.ts";
import {
  DuckDBDataProtocol,
  type AsyncDuckDB,
  type AsyncDuckDBConnection,
} from "@duckdb/duckdb-wasm";
import { AnalyticsEvent } from "@/model/event.ts";
import type { QueryParamValue } from "@lib/queries.ts";
import type { FileMetadata } from "@/services/file-catalog.ts";
import { useDuckDbLoadStore } from "@/services/duck-db-load-state.ts";
import { createDuckDbFileManager } from "@/services/duck-db-file-manager.ts";
import { QueryClient } from "@tanstack/react-query";

export class DuckDbManager {
  private closed = false;
  private files = new Map<string, { file: FileMetadata; alias: string }>();
  private operations: Promise<unknown> = Promise.resolve();
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operations.then(operation);
    this.operations = next.catch(() => undefined);
    return next;
  }
  private db: Promise<AsyncDuckDB | null> = createDb();
  private conn: Promise<AsyncDuckDBConnection> = this.db.then(async (db) => {
    if (!db) throw Error("Failed to init to duckdb");
    const con = await db.connect();
    try {
      await this.setupView(con);
      return con;
    } catch (error) {
      await con.close();
      throw error;
    }
  });

  loadState = useDuckDbLoadStore();
  readonly fileManager;

  constructor(
    private projectId: string,
    private queryClient: QueryClient,
  ) {
    this.fileManager = createDuckDbFileManager(
      this.projectId,
      this,
      this.queryClient,
    );
    void this.fileManager
      .getState()
      .loadData()
      .catch(() => undefined);
    this.db
      .then(() => {
        this.loadState.getState().finishInit();
      })
      .catch((error) => {
        this.loadState
          .getState()
          .setError(
            error instanceof Error
              ? error.message
              : "Database initialization failed",
          );
        this.loadState.getState().finishInit();
      });
  }

  async close() {
    if (this.closed) return;
    this.closed = true;

    await this.operations;
    const [connResult, dbResult] = await Promise.allSettled([
      this.conn,
      this.db,
    ]);
    if (connResult.status === "fulfilled") {
      await connResult.value
        .close()
        .catch((error) =>
          console.warn("Failed to close DuckDB connection", error),
        );
    }
    if (dbResult.status === "fulfilled" && dbResult.value) {
      await dbResult.value
        .terminate()
        .catch((error) =>
          console.warn("Failed to terminate DuckDB worker", error),
        );
    }
  }

  async setupView(conn: AsyncDuckDBConnection) {
    await conn.query(`CREATE VIEW events AS SELECT NULL::VARCHAR id, NULL::TIMESTAMP AS timestamp,
      NULL::VARCHAR event_type, NULL::VARCHAR session_id, NULL::VARCHAR person_id, NULL::JSON properties WHERE false`);
  }

  async setRemoteFiles(files: FileMetadata[]): Promise<boolean> {
    return this.exclusive(async () => {
      if (this.closed) return false;
      const conn = await this.conn;
      const db = await this.db;
      if (!db) throw new Error("Database unavailable");
      const next = new Map<string, { file: FileMetadata; alias: string }>();
      const added: string[] = [];
      let changed = files.length !== this.files.size;
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
        await conn.query("BEGIN TRANSACTION");
        transaction = true;
        if (next.size) {
          const paths = [...next.values()]
            .map((entry) => sqlString(entry.alias))
            .join(",");
          await conn.query(
            `CREATE OR REPLACE VIEW events AS SELECT * FROM read_parquet([${paths}])`,
          );
        } else {
          await conn.query("DROP VIEW events");
          await this.setupView(conn);
        }
        await conn.query("COMMIT");
        transaction = false;
      } catch (error) {
        if (transaction) await conn.query("ROLLBACK");
        for (const alias of added)
          await db.dropFile(alias).catch(() => undefined);
        throw error;
      }
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

  async runQuery({ sql, params }: { sql: string; params: QueryParamValue[] }) {
    await this.ensureFreshAccess();
    return this.exclusive(async () => {
      const conn = await this.conn;
      if (!conn) throw new Error("Database unavailable");
      const preparedQuery = await conn.prepare(sql);
      try {
        const results = await preparedQuery.query(...params);
        console.debug(`Returned ${results.toArray().length} rows`);
        const raw = arrowRows(results);
        return z.array(resultRow).parse(raw);
      } finally {
        await preparedQuery.close();
      }
    });
  }

  async runEventsQuery(query: string, params?: QueryParamValue[]) {
    await this.ensureFreshAccess();
    return this.exclusive(async () => {
      const conn = await this.conn;
      if (!conn) throw new Error("Database unavailable");
      console.debug(query, ...(params ?? []));
      const preparedQuery = await conn.prepare(query);
      try {
        const results = await preparedQuery.query(...(params ?? []));
        console.debug(`Returned ${results.toArray().length} rows`);
        const raw = arrowRows(results);
        return this.mapToEvents(z.array(z.unknown()).parse(raw));
      } finally {
        await preparedQuery.close();
      }
    });
  }

  private async ensureFreshAccess() {
    if (
      [...this.files.values()].some(
        (entry) => Date.parse(entry.file.expiresAt) <= Date.now() + 60_000,
      )
    ) {
      const files = await this.fileManager.getState().loadData();
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
