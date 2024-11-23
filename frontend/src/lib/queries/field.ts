import type { Operator } from '$lib/queries/operators'
import type { QueryParamValue } from '$lib/queries/queries'

const fieldTypes = ['string', 'number', 'boolean'] as const
export type FieldType = (typeof fieldTypes)[number]

// Interface for a field in a query, with support for JSON properties
export interface Field {
    name: string // Field name or JSON path
    type: FieldType
    isProperty?: boolean
}

// Interface for a filter condition
export interface FieldFilter {
    field: Field
    operator: Operator
    value: QueryParamValue
}

// Function to generate the SQL expression for a field
export function getFieldExpression(field: Field, castType?: string): string {
    let expression = ''
    const isJsonField = field.name.startsWith('$.') || field.isProperty
    const nameCleaned = field.name.replace(/\$\./g, '')
    if (isJsonField) {
        const jsonPath = `$.${nameCleaned}`
        expression = `CAST(json_extract(properties, '${jsonPath}') AS ${castType ?? 'VARCHAR'})`
    } else {
        if (castType) {
            expression = `CAST(${expression} AS ${castType})`
        } else {
            expression = field.name
        }
    }

    return expression
}

export const idField: Field = {
    name: 'id',
    type: 'string',
}

export const userField: Field = {
    name: 'user_id',
    type: 'string',
}
