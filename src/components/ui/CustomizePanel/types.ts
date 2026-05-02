/**
 * Shared Customize Panel — Types
 * ================================
 */

export type ColumnDef<K extends string = string> = {
    key: K
    label: string
    sublabel?: string
    defaultVisible?: boolean
    alwaysVisible?: boolean
}

export type FilterDef<K extends string = string> = {
    key: K
    label: string
    defaultVisible?: boolean
}

export type ViewProfile<K extends string = string> = {
    id: string
    name: string
    columns: Record<K, boolean>
    filters?: Record<string, boolean>
    columnOrder?: K[]
}
