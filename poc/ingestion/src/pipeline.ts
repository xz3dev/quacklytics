import { randomUUID } from 'node:crypto';
import type { Store, Event, Params } from './store.js';

type Session = { id: string; personId: string | null; firstSeen: number; lastSeen: number };
type Person = { id: string; firstSeen: number; properties: Record<string, unknown>; timestamps: Record<string, string> };
type Update = { personId: string; time: number; properties: Record<string, unknown> };
const json = <T>(value: unknown): T => typeof value === 'string' ? JSON.parse(value) : value as T;
const iso = (ms: number) => new Date(ms).toISOString();

export class Pipeline {
  constructor(readonly db: Store, readonly schemas: Store) {}

  async ingest(raw: string, mode = 'pipeline') {
    const input = JSON.parse(raw);
    const batch = Array.isArray(input) ? input : [input];
    const events: Event[] = batch.filter(e => e?.eventType).map(e => ({
      id: randomUUID(), eventType: e.eventType,
      timestamp: e.timestamp ? iso(Date.parse(e.timestamp)) : iso(Date.now()),
      sessionId: e.sessionId || null, personId: e.personId || null,
      properties: e.properties ?? {}, personProperties: e.personProperties ?? {},
    }));
    if (!events.length) return 0;
    if (mode !== 'append') {
      events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      // Like Go: schema discovery happens before identities, schema writes after.
      const discovered = await this.discoverSchemas(events);
      await this.identities(events);
      await this.persistSchemas(discovered);
    }
    await this.db.append(events);
    return events.length;
  }

  private async identities(events: Event[]) {
    const db = this.db;
    const sessionIds = [...new Set(events.flatMap(e => e.sessionId ? [e.sessionId] : []))];
    const sessions = new Map<string, Session>();
    if (sessionIds.length) {
      const [where, params] = db.ids('id', sessionIds);
      const rows = await db.transaction(() => db.rows(`SELECT id,person_id,${db.millis('first_seen')} AS first_seen,${db.millis('last_seen')} AS last_seen FROM sessions WHERE ${where}`, params));
      for (const row of rows) sessions.set(String(row.id), { id: String(row.id), personId: row.person_id as string | null, firstSeen: Number(row.first_seen), lastSeen: Number(row.last_seen) });
    }
    const existingSessions = new Set(sessions.keys());
    const linked = new Map<string, string>();
    for (const e of events) {
      if (!e.sessionId) continue;
      const time = Date.parse(e.timestamp);
      const s = sessions.get(e.sessionId) ?? { id: e.sessionId, personId: null, firstSeen: time, lastSeen: time };
      s.firstSeen = Math.min(time, s.firstSeen); s.lastSeen = Math.max(time, s.lastSeen);
      if (e.personId) {
        if (!s.personId) linked.set(s.id, e.personId);
        s.personId = e.personId;
      }
      sessions.set(s.id, s);
    }
    const personIds = [...new Set(events.flatMap(e => [e.personId, e.sessionId ? sessions.get(e.sessionId)?.personId : null].filter((s): s is string => !!s)))];
    const persons = new Map<string, Person>();
    if (personIds.length) {
      const [where, params] = db.ids('id', personIds);
      const rows = await db.transaction(() => db.rows(`SELECT id,${db.millis('first_seen')} AS first_seen,properties,property_timestamps FROM persons WHERE ${where}`, params));
      for (const row of rows) persons.set(String(row.id), { id: String(row.id), firstSeen: Number(row.first_seen), properties: json(row.properties), timestamps: json(row.property_timestamps) });
    }
    const existingPersons = new Set(persons.keys());
    const updates: Update[] = [];
    for (const e of events) {
      const personId = e.personId || (e.sessionId && sessions.get(e.sessionId)?.personId);
      if (personId && Object.keys(e.personProperties).length) updates.push({ personId, time: Date.parse(e.timestamp), properties: e.personProperties });
    }
    if (linked.size) {
      const [where, params] = db.ids('session_id', [...linked.keys()]);
      const rows = await db.transaction(() => db.rows(`SELECT session_id,${db.millis('timestamp')} AS timestamp,person_properties FROM events WHERE session_id IS NOT NULL AND ${where}`, params));
      for (const row of rows) {
        const properties = json<Record<string, unknown>>(row.person_properties);
        if (Object.keys(properties).length) updates.push({ personId: linked.get(String(row.session_id))!, time: Number(row.timestamp), properties });
      }
    }
    const firstSeen = new Map<string, number>();
    const recordFirst = (id: string, time: number) => firstSeen.set(id, Math.min(firstSeen.get(id) ?? Infinity, time));
    for (const e of events) if (e.personId) recordFirst(e.personId, Date.parse(e.timestamp));
    for (const u of updates) recordFirst(u.personId, u.time);
    for (const id of personIds) if (!persons.has(id)) persons.set(id, { id, firstSeen: firstSeen.get(id) ?? Date.now(), properties: {}, timestamps: {} });
    for (const [id, time] of firstSeen) { const p = persons.get(id); if (p) p.firstSeen = Math.min(p.firstSeen, time); }
    for (const u of updates) {
      const p = persons.get(u.personId);
      if (!p) continue;
      for (const [key, value] of Object.entries(u.properties)) {
        if (p.timestamps[key] && u.time < Date.parse(p.timestamps[key])) continue;
        p.properties[key] = value; p.timestamps[key] = iso(u.time);
      }
    }
    // Preserve the current Go transaction boundaries and per-row update pattern.
    if (persons.size) await db.transaction(async () => {
      const fresh = [...persons.values()].filter(p => !existingPersons.has(p.id));
      await this.insertMany('persons', fresh.map(p => [p.id, iso(p.firstSeen), JSON.stringify(p.properties), JSON.stringify(p.timestamps)]));
      for (const p of persons.values()) if (existingPersons.has(p.id)) await db.run('UPDATE persons SET first_seen=?,properties=?,property_timestamps=? WHERE id=?', [iso(p.firstSeen), JSON.stringify(p.properties), JSON.stringify(p.timestamps), p.id]);
    });
    if (sessions.size) await db.transaction(async () => {
      const fresh = [...sessions.values()].filter(s => !existingSessions.has(s.id));
      await this.insertMany('sessions', fresh.map(s => [s.id, s.personId, iso(s.firstSeen), iso(s.lastSeen)]));
      for (const s of sessions.values()) if (existingSessions.has(s.id)) await db.run('UPDATE sessions SET person_id=?,first_seen=?,last_seen=? WHERE id=?', [s.personId, iso(s.firstSeen), iso(s.lastSeen), s.id]);
    });
  }
  private async insertMany(table: string, rows: Params[]) {
    if (rows.length) await this.db.run(`INSERT INTO ${table} VALUES ${rows.map(r => `(${r.map(() => '?').join(',')})`).join(',')}`, rows.flat());
  }

  private async discoverSchemas(events: Event[]) {
    const types = [...new Set(events.map(e => e.eventType))];
    const existing = await this.schemas.rows(`SELECT id,event_type FROM event_schemas WHERE event_type IN (${types.map(() => '?').join(',')})`, types);
    const schemas = new Map<string, { id?: number; properties: Map<string, { type: string; values: Set<string> }> }>();
    for (const type of types) schemas.set(type, { id: existing.find(r => r.event_type === type)?.id as number | undefined, properties: new Map() });
    for (const event of events) for (const [key, value] of Object.entries(event.properties)) {
      if (value == null) continue;
      const props = schemas.get(event.eventType)!.properties;
      // PoC fixtures use scalar properties. Reject unsupported properties rather
      // than silently claim parity with Go's fmt-based nested-value encoding.
      if (typeof value === 'object') throw new Error('PoC schema inference supports scalar event properties only');
      const type = typeof value === 'number' ? 'number'
        : typeof value === 'string' && /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d/.test(value) && Number.isFinite(Date.parse(value)) ? 'timestamp' : 'string';
      const prop = props.get(key) ?? { type, values: new Set<string>() };
      prop.type = type; prop.values.add(String(value)); props.set(key, prop);
    }
    return schemas;
  }
  private async persistSchemas(schemas: Awaited<ReturnType<Pipeline['discoverSchemas']>>) {
    const db = this.schemas;
    await db.transaction(async () => {
      for (const [eventType, s] of schemas) {
        if (!s.id) {
          await db.run('INSERT INTO event_schemas(event_type) VALUES (?)', [eventType]);
          s.id = Number((await db.rows('SELECT last_insert_rowid() AS id'))[0].id);
        }
        const values: Params[] = [];
        for (const [key, p] of s.properties) {
          let row = (await db.rows('SELECT id FROM event_schema_properties WHERE event_schema_id=? AND key=? LIMIT 1', [s.id, key]))[0];
          if (!row) {
            await db.run('INSERT INTO event_schema_properties(event_schema_id,key,type) VALUES (?,?,?)', [s.id, key, p.type]);
            row = (await db.rows('SELECT last_insert_rowid() AS id'))[0];
          }
          for (const value of p.values) values.push([Number(row.id), value]);
        }
        for (let i = 0; i < values.length; i += 100) {
          const batch = values.slice(i, i + 100);
          await db.run(`INSERT INTO event_schema_property_values(event_schema_property_id,value) VALUES ${batch.map(() => '(?,?)').join(',')} ON CONFLICT(event_schema_property_id,value) DO NOTHING`, batch.flat());
        }
      }
    });
  }
}
