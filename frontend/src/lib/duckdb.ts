import * as duckdb from '@duckdb/duckdb-wasm';
import {LogLevel} from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    // DuckDB 1.33.1-dev53 can fail to link the EH bundle in some browsers.
    // The MVP bundle avoids the new EH-only filesystem imports.
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
};

export async function createDb() {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
        console.warn('DuckDB initialization skipped: not in browser environment');
        return null;
    }

    // Select a bundle based on browser checks
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

    try {
        return await instantiateDb(bundle);
    } catch (error) {
        if (bundle.mainModule === MANUAL_BUNDLES.mvp.mainModule) {
            throw error;
        }

        console.warn('Failed to initialize selected DuckDB WASM bundle, retrying with MVP bundle', error);
        return await instantiateDb({
            mainModule: MANUAL_BUNDLES.mvp.mainModule,
            mainWorker: MANUAL_BUNDLES.mvp.mainWorker,
            pthreadWorker: null,
        });
    }
}

async function instantiateDb(bundle: duckdb.DuckDBBundle) {
    // Instantiate the asynchronous version of DuckDB-wasm
    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger(LogLevel.WARNING);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    try {
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        const conn = await db.connect();
        try {
            await conn.query(`SET TimeZone='UTC';`);
        } finally {
            await conn.close();
        }
    } catch (error) {
        await db.terminate();
        throw error;
    }

    return db;
}
