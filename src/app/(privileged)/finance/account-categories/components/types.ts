/* ═══════════════════════════════════════════════════════════
 *  SHARED TYPES — Finance Account Categories Module
 * ═══════════════════════════════════════════════════════════ */

export interface AccountCategoryNode {
    id: number
    name: string
    code: string
    icon: string
    color: string
    description?: string
    sort_order: number
    is_active: boolean
    // COA linkage
    coa_parent?: number | null
    coa_parent_name?: string
    coa_parent_code?: string
    // Child account defaults
    default_pos_enabled: boolean
    default_has_account_book: boolean
    // Digital integration
    is_digital: boolean
    digital_gateway?: number | null
    digital_gateway_name?: string
    // Counts
    account_count?: number
    // Synthetic field for TreeMaster (flat list — always null)
    parent: null
    // Allow extra fields from API
    [key: string]: unknown
}

export type PanelTab = 'overview' | 'accounts'
