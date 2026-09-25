import assert from 'node:assert/strict'
import {after, test} from 'node:test'
import {createRequire} from 'node:module'
import {build} from 'esbuild'

const require = createRequire(import.meta.url)
const duckdb = require('@duckdb/duckdb-wasm/blocking')
const bundled = await build({
    entryPoints: [new URL('../src/lib/insight-queries.ts', import.meta.url).pathname],
    tsconfig: new URL('../tsconfig.app.json', import.meta.url).pathname,
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
})
const {buildPathQuery, buildBreakdownQuery} = await import(
    `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)
const db = await duckdb.createDuckDB({
    mvp: {mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm')},
    eh: {mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm')},
}, new duckdb.VoidLogger(), duckdb.NODE_RUNTIME)
await db.instantiate()
const connection = db.connect()
after(() => connection.close())

connection.query(`
    CREATE TABLE events (
        id VARCHAR, person_id VARCHAR, session_id VARCHAR,
        timestamp TIMESTAMP, event_type VARCHAR, properties JSON
    );
    INSERT INTO events VALUES
        ('1', 'actor', NULL, '2026-01-01 10:00:00', 'A', '{"anchor":"yes"}'),
        ('2', 'actor', NULL, '2026-01-01 11:00:00', 'B', '{}'),
        ('3', 'actor', NULL, '2026-01-01 12:00:00', 'B', '{}'),
        ('4', 'other', NULL, '2026-01-01 10:30:00', 'C', '{}'),
        ('5', 'actor', NULL, '2025-12-31 23:00:00', 'outside', '{}');
`)

function query(built) {
    const statement = connection.prepare(built.sql)
    try {
        return statement.query(...built.params).toArray().map(row => row.toJSON())
    } finally {
        statement.close()
    }
}

const pathConfig = {
    duration: '2026-01-01 - 2026-01-01',
    anchorQuery: {filters: []},
    direction: 'forward',
    stepField: {name: 'event_type', type: 'string'},
    maxSteps: 2,
    limit: 100,
}
const anchor = value => ({field: {name: 'event_type', type: 'string'}, operator: '=', value})
function paths(overrides) {
    return query(buildPathQuery({...pathConfig, ...overrides})).map(row => ({
        ...row, step_distance: Number(row.step_distance), result_value: Number(row.result_value),
    }))
}

test('forward anchors retain other event types and separate repeated targets by distance', () => {
    assert.deepEqual(paths({anchorQuery: {filters: [anchor('A')]}}), [
        {source_step: 'A', target_step: 'B', step_distance: 1, result_value: 1},
        {source_step: 'A', target_step: 'B', step_distance: 2, result_value: 1},
    ])
})

test('backward anchors retain preceding events within the date range', () => {
    assert.deepEqual(paths({direction: 'backward', anchorQuery: {filters: [anchor('B')]}}), [
        {source_step: 'B', target_step: 'A', step_distance: 1, result_value: 1},
        {source_step: 'B', target_step: 'B', step_distance: 1, result_value: 1},
        {source_step: 'B', target_step: 'A', step_distance: 2, result_value: 1},
    ])
})

test('property anchors bind parameters correctly without removing target events', () => {
    assert.deepEqual(paths({anchorQuery: {filters: [
        anchor('A'),
        {field: {name: 'anchor', type: 'string', isProperty: true}, operator: '=', value: 'yes'},
    ]}}), paths({anchorQuery: {filters: [anchor('A')]}}))
})

test('unfiltered one-step paths keep actors separate', () => {
    assert.deepEqual(paths({maxSteps: 1}), [
        {source_step: 'A', target_step: 'B', step_distance: 1, result_value: 1},
        {source_step: 'B', target_step: 'B', step_distance: 1, result_value: 1},
    ])
})

test('timestamp breakdowns return text labels', () => {
    const rows = query(buildBreakdownQuery({
        duration: pathConfig.duration,
        dimension: {name: 'timestamp', type: 'timestamp'},
        aggregation: {function: 'COUNT', field: {name: 'id', type: 'string'}},
    }))
    assert.deepEqual(rows.map(row => row.dimension_value).sort(), [
        '2026-01-01 10:00:00', '2026-01-01 10:30:00',
        '2026-01-01 11:00:00', '2026-01-01 12:00:00',
    ])
    assert.ok(rows.every(row => Number(row.result_value) === 1))
})

test('missing property dimensions still use the missing label', () => {
    const rows = query(buildBreakdownQuery({
        duration: pathConfig.duration,
        dimension: {name: 'anchor', type: 'string', isProperty: true},
        aggregation: {function: 'COUNT', field: {name: 'id', type: 'string'}},
    }))
    assert.deepEqual(rows.map(row => [row.dimension_value, Number(row.result_value)]), [
        ['(missing)', 3], ['yes', 1],
    ])
})
