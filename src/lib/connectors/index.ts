/**
 * Module Connector - Base Infrastructure
 * 
 * Connectors handle inter-module communication with graceful fallback.
 * When a target module is not installed, connectors return null/empty.
 */

import { erpFetch } from '@/lib/erp-api'

/**
 * Check if a module is enabled for the current organization
 */
export async function isModuleEnabled(moduleCode: string): Promise<boolean> {
    try {
        const res = await erpFetch(`modules/${moduleCode}/status/`)
        return res?.is_enabled ?? false
    } catch {
        return false
    }
}

/**
 * Create a guarded connector function
 * Returns null if module is not enabled, otherwise calls the function
 */
export function createConnector<T>(
    moduleCode: string,
    fetchFn: () => Promise<T>,
    fallback: T
) {
    return async (): Promise<T> => {
        if (!await isModuleEnabled(moduleCode)) {
            return fallback
        }
        try {
            return await fetchFn()
        } catch {
            return fallback
        }
    }
}

/**
 * Module Connector Registry
 * Central registry of all module connectors
 */
export const ModuleConnectors = {
    // Inventory Module Connectors
    inventory: {
        getProductCost: createConnector('inventory',
            async () => erpFetch('products/cost/'),
            null
        ),
        getCategories: createConnector('inventory',
            async () => erpFetch('categories/'),
            []
        ),
    },

    // Finance Module Connectors
    finance: {
        getAccounts: createConnector('finance',
            async () => erpFetch('chart-of-accounts/'),
            []
        ),
    },

    // CRM Module Connectors
    crm: {
        getContacts: createConnector('crm',
            async () => erpFetch('contacts/'),
            []
        ),
    },
}
