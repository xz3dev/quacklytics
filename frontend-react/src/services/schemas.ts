// src/services/schema.ts
import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { http } from '@/lib/fetch'

export interface Field {
    name: string
    type: FieldType
    isProperty?: boolean
}

export type FieldWithId = Field & { id: number }
const fieldTypes = ['string', 'number', 'boolean', 'json', 'timestamp'] as const
export type FieldType = (typeof fieldTypes)[number]

export interface Schema {
    uniqueProperties: FieldWithId[]
    events: Record<string, FieldWithId[]>
}

type SchemaResponse = Record<
    string,
    Record<string, { type: string, id: number }>
>

export const SCHEMA_KEY = (project: string) => ['schema', project] as const
export const SCHEMA_PROP_KEY = (project: string, propId: number) => ['schema', project, propId] as const

const schemaApi = {
    getSchema: async (project: string): Promise<Schema> => {
        const response = await http.get<SchemaResponse>(`${project}/schema`)
        return parseSchema(response ?? {})
    },
    getPropValues: async (project: string, id: number): Promise<string[]> => {
        const response = await http.get<string[]>(`${project}/schema/prop/${id}`)
        return response ?? []
    }
}

function parseSchema(schema: SchemaResponse): Schema {
    const uniqueProperties: FieldWithId[] = []
    const events: Record<string, FieldWithId[]> = {}

    for (const [eventType, properties] of Object.entries(schema)) {
        events[eventType] = []
        for (const [key, details] of Object.entries(properties)) {
            const field: FieldWithId = {
                name: key,
                type: details.type as FieldType,
                isProperty: true,
                id: details.id,
            }

            // Add field to collections
            events[eventType].push(field)
            if (!uniqueProperties.find((p) => p.name === key)) {
                uniqueProperties.push(field)
            }
        }
    }

    return {
        uniqueProperties,
        events,
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
            events: {},
        },
        ...options,
    })
}

export function usePropValues(project: string, id: number, enabled: boolean = true) {
    return useQuery<string[], Error>({
        queryKey: SCHEMA_PROP_KEY(project, id),
        queryFn: () => schemaApi.getPropValues(project, id),
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false, // Schema doesn't change often
        placeholderData: [],
        enabled,
    })
}
