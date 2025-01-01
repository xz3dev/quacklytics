export interface Field {
    name: string
    type: string
}

export interface FieldFilter {
    field: Field
    operator: Operator
    value: string
}

export const operators = [
    '=',
    '>',
    '<',
    '>=',
    '<=',
    '<>',
    'LIKE',
    'IN',
] as const
export type Operator = (typeof operators)[number]

