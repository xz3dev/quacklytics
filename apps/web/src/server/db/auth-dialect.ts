import type { Database } from "bun:sqlite";
import {
  CompiledQuery,
  SqliteDialect,
  SqliteDriver,
  type DatabaseConnection,
  type SqliteDatabase,
} from "kysely";
import { z } from "zod";

const bindings = z.array(
  z.union([
    z.string(),
    z.number(),
    z.bigint(),
    z.boolean(),
    z.null(),
    z.instanceof(Uint8Array),
  ]),
);

// Better Auth reads before it writes inside its transactions. SQLite refuses to
// upgrade a deferred read lock while another worker writes, without waiting for
// busy_timeout, so take the write lock when the transaction begins.
class ImmediateSqliteDriver extends SqliteDriver {
  override async beginTransaction(connection: DatabaseConnection) {
    await connection.executeQuery(CompiledQuery.raw("begin immediate"));
  }
}

export class ImmediateSqliteDialect extends SqliteDialect {
  readonly #database: SqliteDatabase;
  constructor(db: Database) {
    const database: SqliteDatabase = {
      close: () => db.close(),
      prepare: (sql) => {
        const statement = db.prepare(sql);
        return {
          reader: statement.columnNames.length > 0,
          all: (parameters) => statement.all(...bindings.parse(parameters)),
          run: (parameters) => statement.run(...bindings.parse(parameters)),
          iterate: (parameters) =>
            statement.iterate(...bindings.parse(parameters)),
        };
      },
    };
    super({ database });
    this.#database = database;
  }
  override createDriver() {
    return new ImmediateSqliteDriver({ database: this.#database });
  }
}
