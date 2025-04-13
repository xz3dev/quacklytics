
export function toJSON(obj: any): string {
    return JSON.stringify(obj, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
    );
}
