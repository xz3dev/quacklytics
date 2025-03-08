import {createDb} from "@lib/duckdb.ts";
import type {DataType} from '@apache-arrow/ts'
import {AsyncDuckDBConnection} from "@duckdb/duckdb-wasm";
import {AnalyticsEvent, RawEventRow} from "@/model/event.ts";
import {buildQuery, Query, QueryResult} from "@lib/queries.ts";
import {FileDownload} from "@/services/file-catalog.ts";
import {useDataRangeStore} from "@lib/data/data-state.ts";
import {processInBatches} from "@lib/utils/batches.ts";

export class DuckDbManager {
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

        const queries: Promise<any>[] = []

        for (const file of files) {
            console.info(`Importing ${file.name}`)
            const arrayBuffer = await file.blob.arrayBuffer()
            console.log(`File buffer created for ${file.name}`)
            try {
                await db.registerFileBuffer(file.name, new Uint8Array(arrayBuffer))

                console.log(`File buffer registered for ${file.name}`)
                // Import data from the Parquet file into the events table
                const query = conn.query(`
                    insert or ignore into events
                    select *
                    from parquet_scan('${file.name}')
                `)
                    .catch((e) => {
                        console.error(`Failed to import ${file.name}: ${e.message}`)
                    })
                console.log(`Query prepared for ${file.name}`)

                queries.push(query)
            } catch (e) {
                console.error(e)
            }
        }
        console.log(`Importing ${files.length} files...`)
        await Promise.all(queries)
        console.log(`DONE: Importing ${files.length} files...`)

        useDataRangeStore.getState().updateDateRange(files)
        console.log(`Updated date range`)

        await this.updateEffectiveDateRange(conn)
        console.log(`updated effective date range`)
    }

    async importEvents(events: AnalyticsEvent[]) {
        const conn = await this.conn
        const db = await this.db
        if (!db || !conn) {
            console.error('Database connection not available')
            return
        }

        await processInBatches(events, 1000, async (batch) => {
            await this.importEventsRaw(batch, conn)
        })

        console.debug(`Imported ${events.length} events raw`)

        await this.updateEffectiveDateRange(conn)
    }

    private async importEventsRaw(
        events: AnalyticsEvent[],
        conn: AsyncDuckDBConnection,
    ): Promise<void> {
        const batchInsertQuery = `
            insert or ignore into events (id, timestamp, event_type, distinct_id, person_id, properties)
            values
            ${events.map(() => `(?, epoch_ms(?::BIGINT), ?, ?, ?, ?)`).join(", ")}
        `;

        const batchParams: any[] = events.flatMap(event => [
            event.id,
            event.timestamp,
            event.eventType,
            event.distinctId,
            event.personId,
            JSON.stringify(event.properties),
        ]);

        try {
            const q = await conn.prepare(batchInsertQuery)
            await q.query(...batchParams)
            console.debug(`Successfully imported ${events.length} event(s)`);
        } catch (e) {
            console.error(`Failed to batch import events: ${e}`);
        }
    }

    private async updateEffectiveDateRange(
        conn: AsyncDuckDBConnection,
    ) {

        const result = await conn.query(`
            select min(timestamp) as min_date,
                   max(timestamp) as max_date
            from events
        `);

        const data = result.toArray()[0]

        const minDate = new Date(data.min_date)
        const maxDate = new Date(data.max_date)

        const store = useDataRangeStore.getState()
        store.updateEffectiveDateRange(minDate, maxDate)
        store.updateMaxDate(maxDate)
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
