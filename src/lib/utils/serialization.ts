export function serialize<T>(data: T): T {
    return JSON.parse(JSON.stringify(data, (key, value) => {
        if (typeof value === 'bigint') {
            return value.toString()
        }
        // Handle Decimals
        if (typeof value === 'object' && value !== null) {
            if (value.constructor?.name === 'Decimal' || value.d) {
                return value.toString()
            }
        }
        return value
    }))
}

// Alias for backward compatibility
export const serializeDecimals = serialize
