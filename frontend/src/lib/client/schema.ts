import { baseUrl } from '$lib/client/client'
import { http } from '$lib/client/fetch'
import { writable } from 'svelte/store'

import type { Field, FieldType } from '$lib/queries/field'

export type Schema = {
    uniqueProperties: Field[]
    all: Field[]
    events: Record<string, Field[]>
    propertyValues: Record<string, string[]>
}

const emptySchema: Schema = {
    uniqueProperties: [],
    all: [],
    events: {},
    propertyValues: {},
}

type SchemaResponse = Record<
    string,
    Record<string, { type: string; values: string[] }>
>

const getSchema = async (): Promise<Schema> =>
    parseSchema((await http.get<SchemaResponse>(`/schema`)) ?? {})

const parseSchema = (schema: SchemaResponse): Schema => {
    const uniqueProperties: Field[] = []
    const all: Field[] = []
    const events: Record<string, Field[]> = {}
    const propertyValues: Record<string, string[]> = {}

    for (const [eventType, properties] of Object.entries(schema)) {
        events[eventType] = []
        for (const [key, details] of Object.entries(properties)) {
            const field = {
                name: key,
                type: details.type as FieldType,
                isProperty: true,
            } satisfies Field

            // Add field to collections
            all.push(field)
            events[eventType].push(field)
            if (!uniqueProperties.find((p) => p.name === key)) {
                uniqueProperties.push(field)
            }

            // Merge values for this property across all event types
            if (!propertyValues[key]) {
                propertyValues[key] = []
            }
            propertyValues[key] = [
                ...new Set([...propertyValues[key], ...details.values]),
            ]
        }
    }

    return {
        all,
        uniqueProperties,
        events,
        propertyValues,
    }
}

const createSchemaStore = () => {
    const { subscribe, set, update } = writable<Schema>(emptySchema)

    getSchema().then((schema) => set(schema))
    return {
        subscribe,
        update: () => getSchema().then((schema) => set(schema)),
    }
}

export const schemaStore = createSchemaStore()
