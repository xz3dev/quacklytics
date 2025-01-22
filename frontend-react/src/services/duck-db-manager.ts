import {createDb} from "@lib/duckdb.ts";
import type {DataType} from '@apache-arrow/ts'
import {AsyncDuckDBConnection} from "@duckdb/duckdb-wasm";
import {AnalyticsEvent, RawEventRow} from "@/model/event.ts";
import {buildQuery, Query, QueryResult} from "@lib/queries.ts";

export class DuckDbManager {
    private db = createDb()
    private conn = this.db.then(async (db) => {
        const conn =  await db?.connect();
        await conn?.query(`SET TimeZone='UTC';`);
        return conn
    })

    async setupTable(conn: AsyncDuckDBConnection) {
        await conn.query(`
            create table if not exists events
            (
                id          UUID primary key,
                timestamp   timestamp,
                event_type  text,
                distinct_id text,
                person_id   UUID,
                properties  json
            );
        `)
    }

    async importParquetFiles(
        files: Array<{ filename: string; blob: Blob }>,
    ): Promise<void> {
        const conn = await this.conn
        const db = await this.db
        if (!db || !conn) {
            console.error('Database connection not available')
            return
        }

        await this.queryTimeZone()

        await this.setupTable(conn)

        const queries = []

        for (const {filename, blob} of files) {
            const arrayBuffer = await blob.arrayBuffer()
            await db.registerFileBuffer(filename, new Uint8Array(arrayBuffer))

            // Import data from the Parquet file into the events table
            const query = conn.query(`
                insert or ignore into events
                select lpad(to_hex(id::bit::hugeint), 32, '0')       as id,
                       timestamp::timestamp                          as timestamp,
                       eventtype                                     as event_type,
                       distinctid                                    as distinct_id,
                       lpad(to_hex(personid::bit::hugeint), 32, '0') as person_id,
                       properties::json                              as properties
                from parquet_scan('${filename}')
            `)
            queries.push(query)
        }
        await Promise.all(queries)
    }

    async queryTimeZone() {
        const conn = await this.conn
        const db = await this.db
        if (!db || !conn) {
            console.error('Database connection not available')
            return ''
        }
        const results = await conn.query(`select * from duckdb_settings() where name='TimeZone';`)
        const result = results.toArray().map(r => r.toJSON())[0]['value']
        console.log(`Current DB TimeZone:`, result)
    }

    async runQuery<T extends Query>(query: Query) {
        const {sql, params} = buildQuery(query)
        const conn = await this.conn
        if (!conn) return
        const preparedQuery = await conn.prepare(sql)
        const results = await preparedQuery.query(...params)
        await preparedQuery.close()
        console.log(`Returned ${results.toArray().length} rows`)
        return results
            .toArray()
            .map((i: { toJSON(): QueryResult<T> }) => i.toJSON())
    }

    async runEventsQuery<
        T extends {
            [key: string]: DataType
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        } = any,
    >(query: string, params?: unknown[]) {
        const conn = await this.conn
        if (!conn) return
        console.log(query, ...(params ?? []))
        const preparedQuery = await conn.prepare<T>(query)
        const results = await preparedQuery.query()
        console.log(`Returned ${results.toArray().length} rows`)
        return this.mapToEvents(results.toArray())
    }

    mapToEvents(results: RawEventRow[]): AnalyticsEvent[] {
        return results.map(
            (row) =>
                ({
                    id: row.id,
                    personId: row.person_id,
                    distinctId: row.distinct_id,
                    timestamp: new Date(Number(row.timestamp)),
                    eventType: row.event_type,
                    properties: JSON.parse(row.properties),
                }) satisfies AnalyticsEvent,
        )
    }
}
