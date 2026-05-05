'use client'

/**
 * Shared product filters panel — canonical re-export.
 *
 * Source still lives at
 * `app/(privileged)/inventory/products/_components/FiltersPanel.tsx`
 * (the products page owns the dropdown wiring), but consumers — the
 * PO catalogue picker today, brand/category pickers tomorrow — should
 * import from `@/components/products/FiltersPanel` so they don't
 * reach across route groups into another feature's "private"
 * directory.
 */

export { FiltersPanel } from '@/app/(privileged)/inventory/products/_components/FiltersPanel'
