import { DuckDbManager } from '$lib/duck-db-manager'
import { ParquetManager } from '$lib/parquet-manager'

export const dbManager = new DuckDbManager()
export const pqManager = new ParquetManager()
