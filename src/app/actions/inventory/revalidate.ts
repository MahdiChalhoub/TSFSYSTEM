'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * Revalidate inventory entity paths after client-side mutations.
 * Used by EntityProductsTab when its Move / Add flow hits the backend
 * directly via erpFetch (bypassing the server-action wrappers that would
 * normally revalidate).
 */
export async function revalidateEntityPath(entityType: string) {
    switch (entityType) {
        case 'unit':
            revalidatePath('/inventory/units')
            break
        case 'category':
            revalidatePath('/inventory/categories')
            revalidateTag('categories')
            break
        case 'brand':
            revalidatePath('/inventory/brands')
            break
        case 'parfum':
            revalidatePath('/inventory/parfums')
            break
        case 'product-group':
            revalidatePath('/inventory/product-groups')
            break
        default:
            // Fall back to a broad invalidation of the inventory section
            revalidatePath('/inventory', 'layout')
    }
    // Always invalidate the products master list — counts change after moves
    revalidatePath('/inventory/products')
    return { ok: true }
}
