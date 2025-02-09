import {createDb} from "@lib/duckdb.ts";
import type {DataType} from '@apache-arrow/ts'
import {AsyncDuckDBConnection} from "@duckdb/duckdb-wasm";
import {AnalyticsEvent, RawEventRow} from "@/model/event.ts";
import {buildQuery, Query, QueryResult} from "@lib/queries.ts";
import {DiscontinuousRange} from "@lib/utils/ranges.ts";
import {FileDownload} from "@/services/file-catalog.ts";
import {useDateRangeStore} from "@lib/data/data-state.ts";

export class DuckDbManager {
    importedDateRange = new DiscontinuousRange<Date>([])
    private db = createDb()
    private conn = this.db.then(async (db) => {
        if (!db) throw Error(
            'Failed to init to duckdb'
        )
        const con = await db.connect();
        await this.setupTable(con)
        return con
    })

    async setupTable(conn: AsyncDuckDBConnection) {
        console.log(`Creating events table...`)
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

    async importParquet(
        files: Array<FileDownload>,
    ): Promise<void> {
        const conn = await this.conn
        const db = await this.db
        if (!db || !conn) {
            console.error('Database connection not available')
            return
        }

        await this.queryTimeZone()

        const queries: Promise<any>[] = []

        for (const file of files) {
            console.info(`Importing ${file.name}`)
            const arrayBuffer = await file.blob.arrayBuffer()
            await db.registerFileBuffer(file.name, new Uint8Array(arrayBuffer))

            // Import data from the Parquet file into the events table
            const query = conn.query(`
                insert or ignore into events
                select *
                from parquet_scan('${file.name}')
            `).catch((e) => {
                console.error(`Failed to import ${file.name}: ${e.message}`)
            })
            queries.push(query)
        }
        await Promise.all(queries)

        useDateRangeStore.getState().updateDateRange(files)
    }

    async queryTimeZone() {
        const conn = await this.conn
        const db = await this.db
        if (!db || !conn) {
            console.error('Database connection not available')
            return ''
        }
        const results = await conn.query(`select *
                                          from duckdb_settings()
                                          where name = 'TimeZone';`)
        const result = results.toArray().map(r => r.toJSON())[0]['value']
        console.debug(`Current DB TimeZone:`, result)
    }

    async runQuery<T extends Query>(query: Query) {
        const {sql, params} = buildQuery(query)
        const conn = await this.conn
        if (!conn) return
        const preparedQuery = await conn.prepare(sql)
        const results = await preparedQuery.query(...params)
        await preparedQuery.close()
        console.debug(`Returned ${results.toArray().length} rows`)
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
        console.debug(query, ...(params ?? []))
        const preparedQuery = await conn.prepare<T>(query)
        const results = await preparedQuery.query()
        console.debug(`Returned ${results.toArray().length} rows`)
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
