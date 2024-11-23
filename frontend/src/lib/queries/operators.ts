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
