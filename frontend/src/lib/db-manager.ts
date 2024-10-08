import { createDb } from '$lib/duckdb'
import { buildEventQueryUrl, type QueryCondition } from '$lib/queries'
import { stringify as uuidStringify } from 'uuid'
import type { AnalyticsEvent, RawEventRow } from '$lib/event'
import type { DataType } from '@apache-arrow/ts'


class DbManager {
    private db = createDb()
    private conn = this.db.then(db => db?.connect())

    constructor() {
    }


    async loadRecentData() {
        const conn = await this.conn
        const queryUrl = buildEventQueryUrl('http://localhost:3000/events/parquet', recentDataQuery())
        const tableName = 'events'

        // Step 1: Download the entire file
        const response = await fetch('http://localhost:3000/events/parquet')
        const blob = await response.blob()

        // Step 2: Read the file as ArrayBuffer
        const arrayBuffer = await blob.arrayBuffer() // await this.readBlobAsArrayBuffer(blob)
        console.log(arrayBuffer)

        // Step 3: Register the file with DuckDB
        const db = await this.db
        if (!db || !conn) {
            return
        }
        const fileName = 'recent_data.parquet'
        await db.registerFileBuffer(fileName, new Uint8Array(arrayBuffer))
        // Step 4: Attempt to read the Parquet file metadata
        try {
            await conn.query(`select *
                              from parquet_metadata('${fileName}')`)
        } catch (error) {
            console.error('Failed to read Parquet metadata:', error)
            throw new Error('The downloaded file does not appear to be a valid Parquet file')
        }
        await conn.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM parquet_scan('${fileName}')`)

        return this.runQuery(`select *
                              from ${tableName}`)
    }

    async runQuery<T extends {
        [key: string]: DataType;
    } = any>(query: string) {
        const conn = await this.conn
        if (!conn) return
        const results = await conn.query<T>(query)
        return this.mapToEvents(results.toArray())
    }

    mapToEvents(results: RawEventRow[]): AnalyticsEvent[] {
        return results.map((row) => ({
            id: uuidStringify(row.id),
            userId: uuidStringify(row.userId),
            timestamp: new Date(Number(row.timestamp)),
            eventType: row.eventType,
            properties: JSON.parse(row.properties),
        } satisfies AnalyticsEvent))
    }
}

export const dbManager = new DbManager()

const recentDataQuery = (): QueryCondition[] => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return [
        {
            field: 'timestamp',
            operation: 'gte',
            value: sevenDaysAgo,
        },
    ]
}
// {
//     "id": {
//     "0": 1,
//         "1": 244,
//         "2": 60,
//         "3": 207,
//         "4": 217,
//         "5": 199,
//         "6": 79,
//         "7": 173,
//         "8": 186,
//         "9": 182,
//         "10": 82,
//         "11": 31,
//         "12": 213,
//         "13": 140,
//         "14": 77,
//         "15": 240
// },
//     "eventType": "test_type",
//     "userId": {
//     "0": 178,
//         "1": 68,
//         "2": 79,
//         "3": 29,
//         "4": 174,
//         "5": 7,
//         "6": 74,
//         "7": 40,
//         "8": 189,
//         "9": 175,
//         "10": 150,
//         "11": 168,
//         "12": 153,
//         "13": 201,
//         "14": 67,
//         "15": 88
// },
//     "timestamp": 1728104787270,
//     "properties": "{\"flag\":true,\"value\":16}"
// }
