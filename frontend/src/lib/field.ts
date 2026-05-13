import { Field } from "@/model/filters"

// Function to generate the SQL expression for a field
export function getFieldExpression(field: Field, castType?: string): string {
    let expression = ''
    const isJsonField = field.name.startsWith('$.') || field.isProperty
    const nameCleaned = field.name.replace(/\$\./g, '')
    if (isJsonField) {
        const jsonPath = `$.${nameCleaned}`
        expression = `CAST(COALESCE(json_extract_string(properties, '${jsonPath}'), json_extract_string(json_extract_string(properties, '$'), '${jsonPath}')) AS ${castType ?? 'VARCHAR'})`
    } else {
        if (castType) {
            expression = `CAST(${nameCleaned} AS ${castType})`
        } else {
            expression = field.name
        }
    }

    return expression
}
