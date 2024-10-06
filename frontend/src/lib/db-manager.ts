import { AsyncDuckDB } from '@duckdb/duckdb-wasm'
import { createDb } from '$lib/duckdb'
import type { AnalyticsEvent } from '$lib/event'

class DbManager {
    constructor(
        private db: AsyncDuckDB
    ) {
    }

    async persistEvents(events: AnalyticsEvent[]) {
        const connection = await this.db.connect()
        // connection.insertArrowFromIPCStream()
    }
}

async function init() {
    const db = await createDb()
    return new DbManager(db)
}

export const dbManager = init()
