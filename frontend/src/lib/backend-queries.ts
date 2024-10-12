export type OperationType =
    | 'eq'    // Equals
    | 'neq'   // Not Equals
    | 'gt'    // Greater Than
    | 'lt'    // Less Than
    | 'gte'   // Greater Than or Equal
    | 'lte'   // Less Than or Equal
    | 'in'    // In
    | 'nin'   // Not In
    | 'contains';  // Contains

export interface QueryCondition {
    field: string
    operation: OperationType
    value: string | number | boolean | Date | Array<string | number>
    jsonProperty?: string
}

export function buildEventQueryUrl(baseUrl: string, conditions: QueryCondition[]): string {
    const url = new URL(baseUrl)

    conditions.forEach(condition => {
        let key = `${condition.field}__${condition.operation}`
        if(condition.jsonProperty){
            key = `${condition.field}.${condition.jsonProperty}__${condition.operation}`
        }

        if (Array.isArray(condition.value)) {
            url.searchParams.append(key, condition.value.join(','))
        } else if (condition.value instanceof Date) {
            url.searchParams.append(key, condition.value.toISOString())
        } else {
            url.searchParams.append(key, condition.value.toString())
        }
    })

    return url.toString()
}
