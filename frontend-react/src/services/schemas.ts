// src/services/schema.ts
import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { http } from '@/lib/fetch'

export interface Field {
    name: string
    type: FieldType
    isProperty?: boolean
}

const fieldTypes = ['string', 'number', 'boolean'] as const
export type FieldType = (typeof fieldTypes)[number]

export interface Schema {
    uniqueProperties: Field[]
    all: Field[]
    events: Record<string, Field[]>
    propertyValues: Record<string, string[]>
}

type SchemaResponse = Record<
    string,
    Record<string, { type: string; values: string[] }>
>

export const SCHEMA_KEY = (project: string) => ['schema', project] as const

const schemaApi = {
    getSchema: async (project: string): Promise<Schema> => {
        const response = await http.get<SchemaResponse>(`${project}/schema`)
        return parseSchema(response ?? {})
    }
}

function parseSchema(schema: SchemaResponse): Schema {
    const uniqueProperties: Field[] = []
    const all: Field[] = []
    const events: Record<string, Field[]> = {}
    const propertyValues: Record<string, string[]> = {}

    for (const [eventType, properties] of Object.entries(schema)) {
        events[eventType] = []
        for (const [key, details] of Object.entries(properties)) {
            const field: Field = {
                name: key,
                type: details.type as FieldType,
                isProperty: true,
            }

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

// Query hook
export function useSchema(
    project: string,
    options?: Partial<UseQueryOptions<Schema, Error>>
) {
    return useQuery<Schema, Error>({
        queryKey: SCHEMA_KEY(project),
        queryFn: () => schemaApi.getSchema(project),
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false, // Schema doesn't change often
        placeholderData: {
            uniqueProperties: [],
            all: [],
            events: {},
            propertyValues: {},
        },
        ...options,
    })
}
