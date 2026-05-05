/**
 * Shared product filter / lookup types — canonical surface for any page or
 * component that filters products.
 *
 * The actual definitions still live in
 * `app/(privileged)/inventory/products/_lib/` because the products page
 * owns the schema, but consumers (catalogue picker, brand attribute
 * picker, etc.) should import from HERE so they don't reach into another
 * route group's "_private" folder.
 *
 * If the source schema ever moves out of `_lib/`, only this barrel file
 * needs to be updated.
 */
export type { Filters, Lookup, Lookups, ViewProfile, ColumnDef, FilterDef, NumericRange } from
    '@/app/(privileged)/inventory/products/_lib/types'

export {
    EMPTY_FILTERS,
    EMPTY_LOOKUPS,
    DEFAULT_VISIBLE_FILTERS,
    DEFAULT_VISIBLE_COLS,
    ALL_FILTERS,
    ALL_COLUMNS,
    COMPLETENESS_LEVELS,
    STATUS_CONFIG,
    TYPE_CONFIG,
    PIPELINE_STATUS_CONFIG,
    EMPTY_RANGE,
    fmt,
} from '@/app/(privileged)/inventory/products/_lib/constants'
