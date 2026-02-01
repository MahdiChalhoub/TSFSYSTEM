export function serialize<T>(data: T): T {
    return JSON.parse(JSON.stringify(data, (key, value) => {
        // Handle Decimals
        if (typeof value === 'object' && value !== null) {
            if (value.constructor?.name === 'Decimal') {
                return value.toString()
            }
        }
        return value
    }))
}

// Alias for backward compatibility
export const serializeDecimals = serialize
