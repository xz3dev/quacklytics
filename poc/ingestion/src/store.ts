import { sqliteConfig, sqlitePragmas } from './sqlite-config.js';
import { sqliteEventDDL } from "./schema.js";
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import {
  DuckDBInstance, type DuckDBConnection, type DuckDBValue, type DuckDBPreparedStatement,
  listValue, timestampValue, uuidValue,
} from '@duckdb/node-api';

export type Params = (string | number | null | DuckDBValue)[];
export type Row = Record<string, unknown>;
export interface Event {
  id: string; timestamp: string; eventType: string;
  sessionId: string | null; personId: string | null;
  properties: Record<string, unknown>; personProperties: Record<string, unknown>;
}

export class SQLStore {
  private duckStatements = new Map<string, DuckDBPreparedStatement>();
  private statements = new Map<string, Database.Statement>();
  private constructor(
    readonly kind: 'duckdb' | 'sqlite',
    readonly sqlite?: Database.Database,
    readonly instance?: DuckDBInstance,
    readonly conn?: DuckDBConnection,
  ) {}

  static async open(kind: 'duckdb' | 'sqlite', path: string) {
    if (kind === 'sqlite') {
      const db = new Database(path);
      const config = sqliteConfig();
      db.pragma(`journal_mode = ${config.journal}`);
      db.pragma(`synchronous = ${config.synchronous}`);
      for (const [key, value] of Object.entries(sqlitePragmas)) db.pragma(`${key}=${value}`);
      return new SQLStore(kind, db);
    }
    const instance = await DuckDBInstance.create(path);
    return new SQLStore(kind, undefined, instance, await instance.connect());
  }
  private statement(sql: string) {
    let stmt = this.statements.get(sql);
    if (!stmt) { stmt = this.sqlite!.prepare(sql); this.statements.set(sql, stmt); }
    return stmt;
  }
  private async duckStatement(sql: string, params: Params) {
    let stmt = this.duckStatements.get(sql);
    if (!stmt) { stmt = await this.conn!.prepare(sql); this.duckStatements.set(sql, stmt); }
    stmt.bind(params as DuckDBValue[]);
    return stmt;
  }
  async exec(sql: string) {
    if (this.sqlite) this.sqlite.exec(sql);
    else await this.conn!.run(sql);
  }
  async run(sql: string, params: Params = []) {
    if (this.sqlite) this.statement(sql).run(...params);
    else if (process.env.POC_DUCKDB_CACHE === 'off') await this.conn!.run(sql, params as DuckDBValue[]);
    else await (await this.duckStatement(sql, params)).run();
  }
  async rows(sql: string, params: Params = []): Promise<Row[]> {
    if (this.sqlite) return this.statement(sql).all(...params) as Row[];
    return (await this.conn!.runAndReadAll(sql, params as DuckDBValue[])).getRowObjects() as Row[];
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.exec('BEGIN');
    try { const value = await fn(); await this.exec('COMMIT'); return value; }
    catch (error) { await this.exec('ROLLBACK'); throw error; }
  }
  ids(column: string, values: string[]): [string, Params] {
    return this.kind === 'duckdb'
      ? [`list_contains($1::TEXT[], ${column})`, [listValue(values)]]
      : [`${column} IN (${values.map(() => '?').join(',')})`, values];
  }
  millis(column: string) {
    return this.kind === 'duckdb' ? `epoch_ms(${column})` : `CAST(round((julianday(${column})-2440587.5)*86400000) AS INTEGER)`;
  }
  async initEvents(duckSchema: string) {
    if (this.kind === 'duckdb') {
      await this.exec(readFileSync(duckSchema, 'utf8'));
      await this.exec('CREATE INDEX events_timestamp ON events(timestamp); CREATE INDEX events_session ON events(session_id)');
      return;
    }
    await this.exec(sqliteEventDDL);
  }
  async append(events: Event[]) {
    if (this.sqlite) {
      await this.transaction(async () => {
        for (const e of events) await this.run('INSERT INTO events VALUES (?,?,?,?,?,?,?)', [
          e.id, e.timestamp, e.eventType, e.sessionId, e.personId,
          JSON.stringify(e.properties), JSON.stringify(e.personProperties),
        ]);
      });
      return;
    }
    const appender = await this.conn!.createAppender('events');
    try {
      for (const e of events) {
        appender.appendUUID(uuidValue(BigInt(`0x${e.id.replaceAll('-', '')}`)));
        appender.appendTimestamp(timestampValue(BigInt(Date.parse(e.timestamp)) * 1000n));
        appender.appendVarchar(e.eventType);
        e.sessionId ? appender.appendVarchar(e.sessionId) : appender.appendNull();
        e.personId ? appender.appendVarchar(e.personId) : appender.appendNull();
        appender.appendVarchar(JSON.stringify(e.properties));
        appender.appendVarchar(JSON.stringify(e.personProperties));
        appender.endRow();
      }
    } finally { appender.closeSync(); }
  }
  close() { for (const stmt of this.duckStatements.values()) stmt.destroySync(); this.duckStatements.clear(); this.sqlite?.close(); this.conn?.closeSync(); this.instance?.closeSync(); }
}

export type Store = Pick<SQLStore, "kind" | "exec" | "run" | "rows" | "transaction" | "ids" | "millis" | "initEvents" | "append" | "close">;
export { schemaDDL } from "./schema.js";
