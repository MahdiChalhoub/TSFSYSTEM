/**
 * Sidebar Permission Map
 * ======================
 * Maps sidebar module keys to the minimum permission prefix required.
 * If a user has ANY permission starting with the prefix, the module section is visible.
 * 
 * This is used by the Sidebar to filter menu items based on the current user's role.
 * The mapping is intentionally coarse — module-level, not page-level — to avoid
 * maintaining 200+ individual route-to-permission mappings.
 */

export const MODULE_PERMISSION_MAP: Record<string, string[]> = {
    // Module key → permission prefixes that grant access to this sidebar section
    core:       ['admin.', 'workspace.'],
    pos:        ['sales.', 'pos.', 'delivery.'],
    inventory:  ['inventory.', 'products.'],
    finance:    ['finance.', 'tax.'],
    crm:        ['crm.'],
    hr:         ['hr.'],
    ecommerce:  ['ecommerce.'],
    mcp:        ['mcp.'],
    purchases:  ['purchases.'],
}

/**
 * Check if the user has access to a given sidebar module.
 * Returns true if the user has ANY permission starting with ANY of the module's prefixes.
 * Superusers always return true.
 */
export function canAccessModule(
    moduleKey: string,
    userPermissions: string[],
    isAdmin: boolean
): boolean {
    // Superusers/admins see everything
    if (isAdmin) return true

    // Unknown modules are visible by default (don't lock users out of dynamic modules)
    const prefixes = MODULE_PERMISSION_MAP[moduleKey]
    if (!prefixes) return true

    // Check if user has ANY permission with ANY matching prefix
    return userPermissions.some(perm =>
        prefixes.some(prefix => perm.startsWith(prefix))
    )
}
