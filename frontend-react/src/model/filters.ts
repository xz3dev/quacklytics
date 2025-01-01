export interface Field {
    name: string
    type: string
}

export interface FieldFilter {
    field: Field
    operator: Operator
    value: string
}

export type Operator = '=' | '>' | '<' | '>=' | '<=' | '<>' | 'LIKE' | 'IN'
