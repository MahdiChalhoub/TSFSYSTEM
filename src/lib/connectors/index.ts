/**
 * Module Connector - State-Aware Infrastructure
 * ==============================================
 * 
 * The Connector is the nervous system of the platform:
 * - 🧠 Memory of what modules provide/need
 * - 🚦 Traffic controller for inter-module communication  
 * - 🛡 Stability shield against missing modules
 * 
 * Modules never talk directly - they go through the Connector.
 * The Connector enforces policy, not the modules.
 */

import { erpFetch } from '@/lib/erp-api'

// =============================================================================
// TYPES
// =============================================================================

/**
 * The 4 states a module can be in relative to a request.
 * These are NOT errors - they are states the Connector manages.
 */
export type ModuleState =
    | 'available'      // 🟢 Module installed and enabled
    | 'missing'        // 🟡 Module not installed on system
    | 'disabled'       // 🔵 Module installed but disabled for tenant  
    | 'unauthorized'   // 🔴 Module exists but no permission

/**
 * Response from the Connector includes metadata about how request was handled.
 */
export interface ConnectorResponse<T> {
    data: T
    state: ModuleState
    from_cache: boolean
    buffered: boolean
    fallback_applied: boolean
    error: string | null
    timestamp: string
}

/**
 * Module state information from the backend.
 */
export interface ModuleStateInfo {
    module_code: string
    module_name: string
    state: ModuleState
    is_available: boolean
    pending_buffers: number
    last_activity: string | null
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Get the state of a specific module for the current organization.
 */
export async function getModuleState(moduleCode: string): Promise<ModuleState> {
    try {
        const res = await erpFetch(`modules/${moduleCode}/status/`)

        if (!res) return 'missing'

        // Determine state from response
        if (res.is_enabled === true) return 'available'
        if (res.is_disabled === true) return 'disabled'
        if (res.is_unauthorized === true) return 'unauthorized'

        return 'missing'
    } catch {
        return 'missing'
    }
}

/**
 * Get states of all modules for the current organization.
 */
export async function getAllModuleStates(): Promise<ModuleStateInfo[]> {
    try {
        const res = await erpFetch('connector/states/')
        return res || []
    } catch {
        return []
    }
}

/**
 * Check if a module is available (legacy compatibility function).
 */
export async function isModuleEnabled(moduleCode: string): Promise<boolean> {
    const state = await getModuleState(moduleCode)
    return state === 'available'
}

// =============================================================================
// CONNECTOR FACTORY
// =============================================================================

/**
 * Create a state-aware connector function.
 * Returns full response metadata including state, cache status, etc.
 */
export function createStateAwareConnector<T>(
    moduleCode: string,
    endpoint: string,
    fallback: T
): () => Promise<ConnectorResponse<T>> {
    return async (): Promise<ConnectorResponse<T>> => {
        try {
            // Route through backend Connector for full state management
            const response = await erpFetch('connector/route/', {
                method: 'POST',
                body: JSON.stringify({
                    target_module: moduleCode,
                    endpoint: endpoint,
                    operation: 'read'
                })
            })

            if (response && typeof response === 'object') {
                return {
                    data: response.data ?? fallback,
                    state: response.state || 'available',
                    from_cache: response.from_cache || false,
                    buffered: response.buffered || false,
                    fallback_applied: response.fallback_applied || false,
                    error: response.error || null,
                    timestamp: response.timestamp || new Date().toISOString()
                }
            }

            // Direct call fallback
            return {
                data: fallback,
                state: 'missing',
                from_cache: false,
                buffered: false,
                fallback_applied: true,
                error: null,
                timestamp: new Date().toISOString()
            }
        } catch (err) {
            return {
                data: fallback,
                state: 'missing',
                from_cache: false,
                buffered: false,
                fallback_applied: true,
                error: String(err),
                timestamp: new Date().toISOString()
            }
        }
    }
}

/**
 * Create a simple connector function (legacy compatibility).
 * Returns just the data, not full metadata.
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

// =============================================================================
// WRITE CONNECTOR
// =============================================================================

/**
 * Route a write operation through the Connector.
 * Writes may be buffered if target module is unavailable.
 */
export async function connectorWrite<T>(
    targetModule: string,
    endpoint: string,
    data: T,
    method: string = 'POST'
): Promise<ConnectorResponse<unknown>> {
    try {
        const response = await erpFetch('connector/route/', {
            method: 'POST',
            body: JSON.stringify({
                target_module: targetModule,
                endpoint: endpoint,
                operation: 'write',
                data: data,
                method: method
            })
        })

        return {
            data: response?.data ?? null,
            state: response?.state || 'available',
            from_cache: false,
            buffered: response?.buffered || false,
            fallback_applied: response?.fallback_applied || false,
            error: response?.error || null,
            timestamp: new Date().toISOString()
        }
    } catch (err) {
        return {
            data: null,
            state: 'missing',
            from_cache: false,
            buffered: false,
            fallback_applied: true,
            error: String(err),
            timestamp: new Date().toISOString()
        }
    }
}

// =============================================================================
// MODULE CONNECTOR REGISTRY
// =============================================================================

/**
 * Central registry of all module connectors.
 * This is the public API for inter-module communication.
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
        getProducts: createConnector('inventory',
            async () => erpFetch('products/'),
            []
        ),
        getBrands: createConnector('inventory',
            async () => erpFetch('brands/'),
            []
        ),
    },

    // Finance Module Connectors
    finance: {
        getAccounts: createConnector('finance',
            async () => erpFetch('accounts/'),
            []
        ),
        getChartOfAccounts: createConnector('finance',
            async () => erpFetch('coa/'),
            []
        ),
        getFiscalYears: createConnector('finance',
            async () => erpFetch('fiscal-years/'),
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

    // POS Module Connectors
    pos: {
        getSessions: createConnector('pos',
            async () => erpFetch('pos/sessions/'),
            []
        ),
    },
}

// =============================================================================
// STATE-AWARE CONNECTORS (Advanced)
// =============================================================================

/**
 * State-aware connector registry with full metadata.
 * Use these when you need to know if data is cached, module state, etc.
 */
export const StateAwareConnectors = {
    inventory: {
        getProducts: createStateAwareConnector('inventory', 'products/', []),
        getCategories: createStateAwareConnector('inventory', 'categories/', []),
    },
    finance: {
        getAccounts: createStateAwareConnector('finance', 'accounts/', []),
    },
}
