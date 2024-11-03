import { baseUrl } from '$lib/client/client'
import { http } from '$lib/client/fetch'
import { writable } from 'svelte/store'
import type { Field, FieldType } from '$lib/local-queries'


export type Schema = {
    uniqueProperties: Field[]
    all: Field[]
    events: Record<string, Field[]>
}

const emptySchema: Schema = {
    uniqueProperties: [],
    all: [],
    events: {},
}

const getSchema = async (): Promise<Schema> => parseSchema(await http.get<Record<string, Record<string, string>>>(`/schema`) ?? {})

const parseSchema = (schema: Record<string, Record<string, string>>): Schema=> {
    const uniqueProperties: Field[] = []
    const all: Field[] = []
    const events: Record<string, Field[]> = {}
    for (const [eventType, properties] of Object.entries(schema)) {
        events[eventType] = []
        for (const [key, type] of Object.entries(properties)) {
            const field = {
                name: key,
                type: type as FieldType,
                isProperty: true,
            } satisfies Field
            all.push(field)
            events[eventType].push(field)
            if (!uniqueProperties.find(p => p.name === key)) {
                uniqueProperties.push(field)
            }
        }
    }
    return {
        all,
        uniqueProperties,
        events,
    }
}

const createSchemaStore = () => {
    const { subscribe, set, update } = writable<Schema>(emptySchema)

    getSchema().then(schema => set(schema))
    return {
        subscribe,
        update: () => getSchema().then(schema => set(schema)),
    }
}

export const schemaStore = createSchemaStore()
