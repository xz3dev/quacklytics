import {createDb} from "@lib/duckdb.ts";
import type {AsyncDuckDB, AsyncDuckDBConnection} from "@duckdb/duckdb-wasm";
import {AnalyticsEvent, RawEventRow} from "@/model/event.ts";
import {Query, QueryResult} from "@lib/trend-queries.ts";
import type {QueryParamValue} from "@lib/queries.ts";
import {FileDownload} from "@/services/file-catalog.ts";
import {processInBatches} from "@lib/utils/batches.ts";
import {useDuckDbDownloadStore} from "@/services/duck-db-download-state.ts";
import {useDuckDbDataRangeStore} from "@/services/duck-db-data-range.ts";
import {createDuckDbFileManager} from "@/services/duck-db-file-manager.ts";
import {QueryClient} from "@tanstack/react-query";

export class DuckDbManager {
    private closed = false
    private db: Promise<AsyncDuckDB | null> = createDb()
    private conn: Promise<AsyncDuckDBConnection> = this.db.then(async (db) => {
        if (!db) throw Error(
            'Failed to init to duckdb'
        )
        const con = await db.connect();
        try {
            await this.setupTable(con)
            return con
        } catch (error) {
            await con.close()
            throw error
        }
    })

    dataRanges = useDuckDbDataRangeStore()
    downloadState = useDuckDbDownloadStore()
    readonly fileManager

    constructor(
        private projectId: string,
        private queryClient: QueryClient,
    ) {
        this.fileManager = createDuckDbFileManager(this.projectId, this, this.queryClient)
        void this.fileManager.getState().loadData()
        this.db
            .then(() => {
                this.downloadState.getState().finishInit()
            })
            .catch((error) => {
                console.error('Failed to initialize DuckDB', error)
                this.downloadState.getState().finishInit()
            })
    }

    async close() {
        if (this.closed) return
        this.closed = true

        const [connResult, dbResult] = await Promise.allSettled([this.conn, this.db])
        if (connResult.status === 'fulfilled') {
            await connResult.value.close().catch((error) => console.warn('Failed to close DuckDB connection', error))
        }
        if (dbResult.status === 'fulfilled' && dbResult.value) {
            await dbResult.value.terminate().catch((error) => console.warn('Failed to terminate DuckDB worker', error))
        }
    }

    async setupTable(conn: AsyncDuckDBConnection) {
        console.log(`Creating events table...`)
        await conn.query(`create table if not exists events
(
    id
    UUID
    primary
    key,
    timestamp
    timestamp,
    event_type
    text,
    distinct_id
    text,
    person_id
    UUID,
    properties
    json
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

        const queries: Promise<void>[] = []

        console.log(`Importing ${files.length} files...`)
        for (const file of files) {
            console.info(`Importing ${file.name}`)
            const arrayBuffer = await file.blob.arrayBuffer()
            try {
                await db.registerFileBuffer(file.name, new Uint8Array(arrayBuffer))
                // Import data from the Parquet file into the events table
                const query = conn.query(`
                    insert
                    or ignore into events
                    select distinct
                    on (id) id, timestamp, event_type, distinct_id, person_id, properties
                    from parquet_scan(${sqlString(file.name)})
                `)
                    .then(() => undefined)
                    .catch((e) => {
                        console.error(`Failed to import ${file.name}: ${e.message}`)
                    })
                    .finally(async () => {
                        await db.dropFile(file.name).catch((e) => {
                            console.warn(`Failed to drop DuckDB file buffer ${file.name}: ${e.message}`)
                        })
                        this.downloadState.getState().finishTask(file.name, 'import')
                    })


                queries.push(query)
            } catch (e) {
                console.error(e)
            }
        }
        await Promise.all(queries)
        console.log(`DONE: Importing ${files.length} files...`)

        this.dataRanges.getState().updateDateRange(files)

        await this.updateEffectiveDateRange(conn)

    }

    async importEvents(events: AnalyticsEvent[]) {
        const conn = await this.conn
        const db = await this.db
        if (!db || !conn) {
            console.error('Database connection not available')
            return
        }

        await processInBatches(events, 50, async (batch) => {
            await this.importEventsRaw(batch, conn)
        })

        console.debug(`Imported ${events.length} events raw`)

        await this.updateEffectiveDateRange(conn)
    }

    private async importEventsRaw(
        events: AnalyticsEvent[],
        conn: AsyncDuckDBConnection,
    ): Promise<void> {
        if (events.length === 0) {
            console.log(`No events to import.`)
            return
        }
        events = events.slice()

        const batchInsertQuery = `
            insert
            or ignore into events (id, timestamp, event_type, distinct_id, person_id, properties)
            values
            ${events.map(() => `(?, ?, ?, ?, ?, ?)`).join(", ")}
        `;

        const batchParams: QueryParamValue[] = events.flatMap(event => [
            event.id,
            event.timestamp,
            event.eventType,
            event.distinctId,
            event.personId,
            JSON.stringify(event.properties),
        ]);

        try {
            const q = await conn.prepare(batchInsertQuery)
            try {
                await q.query(...batchParams)
            } finally {
                await q.close()
            }
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
        if (!data?.min_date || !data?.max_date) return

        const minDate = new Date(data.min_date)
        const maxDate = new Date(data.max_date)

        const store = this.dataRanges.getState()
        store.updateEffectiveDateRange(minDate, maxDate)
        store.updateMaxDate(maxDate)
    }

    async runQuery<T extends Query>({sql, params}: {
        sql: string,
        params: QueryParamValue[],
    }) {
        // const {sql, params} = buildQuery(query)
        const conn = await this.conn
        if (!conn) return
        const preparedQuery = await conn.prepare(sql)
        try {
            const results = await preparedQuery.query(...params)
            console.debug(`Returned ${results.toArray().length} rows`)
            return results
                .toArray()
                .map((i: { toJSON(): QueryResult<T> }) => i.toJSON())
        } finally {
            await preparedQuery.close()
        }
    }

    async runEventsQuery(query: string, params?: QueryParamValue[]) {
        const conn = await this.conn
        if (!conn) return
        console.debug(query, ...(params ?? []))
        const preparedQuery = await conn.prepare(query)
        try {
            const results = await preparedQuery.query(...(params ?? []))
            console.debug(`Returned ${results.toArray().length} rows`)
            return this.mapToEvents(results.toArray())
        } finally {
            await preparedQuery.close()
        }
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

function sqlString(value: string) {
    return `'${value.replace(/'/g, "''")}'`
}
