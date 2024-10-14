import { createDb } from '$lib/duckdb'
import type { AnalyticsEvent, RawEventRow } from '$lib/event'
import type { DataType } from '@apache-arrow/ts'
import { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'


export class DuckDbManager {
    private db = createDb()
    private conn = this.db.then(db => db?.connect())

    constructor() {
    }

    async setupTable(conn: AsyncDuckDBConnection) {
        await conn.query(`
            create table if not exists events
            (
                id         UUID primary key,
                timestamp  timestamp,
                event_type text,
                user_id    UUID,
                properties json
            );
        `)
    }

    async importParquetFiles(files: Array<{ filename: string; blob: Blob }>): Promise<void> {
        const conn = await this.conn
        const db = await this.db
        if (!db || !conn) {
            console.error('Database connection not available')
            return
        }

        await this.setupTable(conn)

        for (const { filename, blob } of files) {
            const arrayBuffer = await blob.arrayBuffer()
            await db.registerFileBuffer(filename, new Uint8Array(arrayBuffer))

            // Import data from the Parquet file into the events table
            await conn.query(`
                insert or ignore into events
                select lpad(to_hex(id::bit::hugeint), 32, '0')     as id,
                       timestamp::timestamp          as timestamp,
                       eventtype as event_type,
                       lpad(to_hex(userid::bit::hugeint), 32, '0') as user_id,
                       properties::json              as properties
                from parquet_scan('${filename}')
            `)
        }
    }

    async runQuery<T extends {
        [key: string]: DataType;
    } = any>(query: string, params?: any[]) {
        const conn = await this.conn
        if (!conn) return
        const preparedQuery = await conn.prepare<T>(query)
        const results = await preparedQuery.query(params)
        console.log(`Returned ${results.toArray().length} rows`)
        return results.toArray().map(i => i.toJSON())
    }

    async runEventsQuery<T extends {
        [key: string]: DataType;
    } = any>(query: string, params?: any[]) {
        const conn = await this.conn
        if (!conn) return
        console.log(query, ...(params ?? []))
        const preparedQuery = await conn.prepare<T>(query)
        const results = await preparedQuery.query()
        console.log(`Returned ${results.toArray().length} rows`)
        return this.mapToEvents(results.toArray())
    }

    mapToEvents(results: RawEventRow[]): AnalyticsEvent[] {
        return results.map((row) => ({
            id: row.id,
            userId: row.user_id,
            timestamp: new Date(Number(row.timestamp)),
            eventType: row.event_type,
            properties: JSON.parse(row.properties),
        } satisfies AnalyticsEvent))
    }
}
