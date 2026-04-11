'use server'

/**
 * Group Stock Aggregation Server Action
 * ======================================
 * Aggregates stock quantities across all members of an InventoryGroup,
 * returning total virtual stock, per-variant breakdown, and sourcing intel.
 */

import { erpFetch } from '@/lib/erp-api'

export interface GroupStockSummary {
    group_id: number
    group_name: string
    group_type: string
    total_stock: number
    variant_count: number
    cheapest_variant: string | null
    cheapest_cost: number | null
    variants: GroupStockVariant[]
}

export interface GroupStockVariant {
    product_id: number
    product_name: string
    product_sku: string
    origin_label: string
    stock_qty: number
    cost_price: number
    selling_price: number
    is_low_stock: boolean
}

/**
 * Get aggregated stock for a product's inventory group.
 * Returns null if the product doesn't belong to any group.
 */
export async function getProductGroupStock(productId: number): Promise<GroupStockSummary | null> {
    try {
        // 1. Find which groups this product belongs to
        const membersRaw = await erpFetch(`inventory/inventory-group-members/?product=${productId}&page_size=10`)
        const members = Array.isArray(membersRaw) ? membersRaw : membersRaw?.results || []
        if (members.length === 0) return null

        // Use the first group (primary group)
        const groupId = members[0].group || members[0].group_id
        if (!groupId) return null

        // 2. Get group summary with stock data
        const summary = await erpFetch(`inventory/inventory-groups/${groupId}/summary/`)
        if (!summary) return null

        const variants: GroupStockVariant[] = (summary.variants || []).map((v: any) => ({
            product_id: v.product_id,
            product_name: v.product_name || '',
            product_sku: v.product_sku || '',
            origin_label: v.origin_label || v.country || '',
            stock_qty: v.stock_qty || 0,
            cost_price: v.cost_price || 0,
            selling_price: v.selling_price_ttc || 0,
            is_low_stock: v.is_low_stock || false,
        }))

        const totalStock = variants.reduce((sum, v) => sum + v.stock_qty, 0)
        const cheapest = variants.reduce((min, v) =>
            v.cost_price > 0 && (min === null || v.cost_price < min.cost_price) ? v : min
            , null as GroupStockVariant | null)

        return {
            group_id: groupId,
            group_name: summary.name || `Group ${groupId}`,
            group_type: summary.group_type || 'EXACT',
            total_stock: Math.round(totalStock),
            variant_count: variants.length,
            cheapest_variant: cheapest?.product_name || null,
            cheapest_cost: cheapest?.cost_price || null,
            variants,
        }
    } catch (error) {
        console.error('[GroupStock] Failed:', error)
        return null
    }
}

/**
 * Batch fetch group stock for multiple products at once.
 * Returns a map of productId -> GroupStockSummary.
 */
export async function getBatchGroupStock(productIds: number[]): Promise<Record<number, GroupStockSummary>> {
    const result: Record<number, GroupStockSummary> = {}
    if (productIds.length === 0) return result

    // Fetch all groups and members in one pass
    try {
        const [groupsRaw, membersRaw] = await Promise.all([
            erpFetch('inventory/inventory-groups/?page_size=9999'),
            erpFetch('inventory/inventory-group-members/?page_size=9999'),
        ])

        const groups = Array.isArray(groupsRaw) ? groupsRaw : groupsRaw?.results || []
        const members = Array.isArray(membersRaw) ? membersRaw : membersRaw?.results || []

        // Build product -> group mapping
        const productToGroup = new Map<number, number>()
        const groupToMembers = new Map<number, any[]>()
        for (const m of members) {
            const pid = m.product || m.product_id
            const gid = m.group || m.group_id
            if (pid && gid) {
                productToGroup.set(pid, gid)
                if (!groupToMembers.has(gid)) groupToMembers.set(gid, [])
                groupToMembers.get(gid)!.push(m)
            }
        }

        // Build group info map
        const groupMap = new Map(groups.map((g: any) => [g.id, g]))

        // For each requested product, return its group stock
        const processedGroups = new Set<number>()
        for (const pid of productIds) {
            const gid = productToGroup.get(pid)
            if (!gid) continue
            if (processedGroups.has(gid)) {
                // Already processed, reference same summary
                for (const otherPid of productIds) {
                    if (productToGroup.get(otherPid) === gid && result[otherPid]) {
                        result[pid] = result[otherPid]
                        break
                    }
                }
                continue
            }

            processedGroups.add(gid)
            const group = groupMap.get(gid) as any
            const gMembers = groupToMembers.get(gid) || []

            // Estimate stock from member data (basic aggregation)
            const variants: GroupStockVariant[] = gMembers.map((m: any) => ({
                product_id: m.product || m.product_id,
                product_name: m.product_name || `Product ${m.product || m.product_id}`,
                product_sku: m.product_sku || '',
                origin_label: m.origin_label || '',
                stock_qty: m.stock_qty || 0,
                cost_price: m.cost_price || 0,
                selling_price: m.selling_price_ttc || 0,
                is_low_stock: m.is_low_stock || false,
            }))

            const totalStock = variants.reduce((sum, v) => sum + v.stock_qty, 0)
            const cheapest = variants.reduce((min, v) =>
                v.cost_price > 0 && (min === null || v.cost_price < min.cost_price) ? v : min
                , null as GroupStockVariant | null)

            result[pid] = {
                group_id: gid,
                group_name: group?.name || `Group ${gid}`,
                group_type: group?.group_type || 'EXACT',
                total_stock: Math.round(totalStock),
                variant_count: variants.length,
                cheapest_variant: cheapest?.product_name || null,
                cheapest_cost: cheapest?.cost_price || null,
                variants,
            }
        }
    } catch (error) {
        console.error('[BatchGroupStock] Failed:', error)
    }

    return result
}
