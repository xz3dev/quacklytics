import { sqliteConfig, sqlitePragmas } from './sqlite-config.js';
import { Database, type Statement, type SQLQueryBindings } from 'bun:sqlite';
import type { Store, Event, Params, Row } from './store.js';
import { sqliteEventDDL } from './schema.js';

// The same SQL, transactions, statement caching, and event insertion loop as
// the Node SQLite adapter. Only the runtime and native SQLite driver change.
export class BunSQLiteStore implements Store {
  readonly kind = 'sqlite' as const;
  private statements = new Map<string, Statement>();

  private constructor(private readonly db: Database) {
    const config = sqliteConfig();
    db.exec(`PRAGMA journal_mode=${config.journal}`);
    db.exec(`PRAGMA synchronous=${config.synchronous}`);
    for (const [key, value] of Object.entries(sqlitePragmas)) db.exec(`PRAGMA ${key}=${value}`);
  }
  static async open(path: string) {
    return new BunSQLiteStore(new Database(path, { create: true, strict: true }));
  }
  private statement(sql: string) {
    let stmt = this.statements.get(sql);
    if (!stmt) { stmt = this.db.prepare(sql); this.statements.set(sql, stmt); }
    return stmt;
  }
  async exec(sql: string) { this.db.exec(sql); }
  async run(sql: string, params: Params = []) {
    this.statement(sql).run(...params as SQLQueryBindings[]);
  }
  async rows(sql: string, params: Params = []): Promise<Row[]> {
    return this.statement(sql).all(...params as SQLQueryBindings[]) as Row[];
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.exec('BEGIN');
    try { const value = await fn(); await this.exec('COMMIT'); return value; }
    catch (error) { await this.exec('ROLLBACK'); throw error; }
  }
  ids(column: string, values: string[]): [string, Params] {
    return [`${column} IN (${values.map(() => '?').join(',')})`, values];
  }
  millis(column: string) {
    return `CAST(round((julianday(${column})-2440587.5)*86400000) AS INTEGER)`;
  }
  async initEvents() { await this.exec(sqliteEventDDL); }
  async append(events: Event[]) {
    await this.transaction(async () => {
      for (const e of events) await this.run('INSERT INTO events VALUES (?,?,?,?,?,?,?)', [
        e.id, e.timestamp, e.eventType, e.sessionId, e.personId,
        JSON.stringify(e.properties), JSON.stringify(e.personProperties),
      ]);
    });
  }
  close() {
    for (const stmt of this.statements.values()) stmt.finalize();
    this.statements.clear();
    this.db.close(true);
  }
}
