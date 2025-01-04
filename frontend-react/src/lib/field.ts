import { Field } from "@/model/filters"

// Function to generate the SQL expression for a field
export function getFieldExpression(field: Field, castType?: string): string {
    let expression = ''
    const isJsonField = field.name.startsWith('$.') || field.isProperty
    const nameCleaned = (field.alias ?? field.name).replace(/\$\./g, '')
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
