// ─── Universal List Component Type Definitions ─────────────────────────────
import { type ReactNode, type ComponentType } from 'react';

/**
 * Column definition for the universal data table.
 */
export interface ColumnDef<T = any> {
    /** Unique key for this column (used for preference storage) */
    key: string;
    /** Display label in the table header */
    label: string;
    /** Whether this column can be sorted */
    sortable?: boolean;
    /** Text alignment */
    align?: 'left' | 'center' | 'right';
    /** Custom cell renderer */
    render?: (value: any, row: T, index: number) => ReactNode;
    /** Whether this column is visible by default (before user customization) */
    defaultVisible?: boolean;
    /** Minimum width in pixels */
    minWidth?: number;
}

/**
 * Filter definition for search/filter bars.
 */
export interface FilterDef {
    /** Unique key matching a data field */
    key: string;
    /** Display label */
    label: string;
    /** Filter input type */
    type: 'select' | 'date' | 'daterange' | 'text' | 'checkbox' | 'multiselect';
    /** Options for select/multiselect filters */
    options?: { value: string; label: string }[];
    /** Show in the quick filter bar (true) or advanced panel (false) */
    isQuick?: boolean;
    /** Placeholder text */
    placeholder?: string;
}

/**
 * Row action definition (view, edit, delete, etc.)
 */
export interface ActionDef<T = any> {
    /** Icon component from lucide-react */
    icon: ComponentType<{ size?: number; className?: string }>;
    /** Tooltip label */
    label: string;
    /** Handler when action is clicked */
    onClick: (row: T) => void;
    /** Optional: only show if condition is met */
    show?: (row: T) => boolean;
    /** Optional: variant for coloring */
    variant?: 'default' | 'danger' | 'success' | 'warning';
}

/**
 * Props for the UniversalList component.
 */
export interface UniversalListProps<T = any> {
    /** Unique list key for preference storage (e.g. 'inventory.products') */
    listKey: string;
    /** Page title */
    title: string;
    /** Title icon */
    icon?: ComponentType<{ size?: number; className?: string }>;
    /** Accent color class (e.g. 'emerald', 'indigo', 'blue') */
    accent?: string;
    /** All available columns */
    columns: ColumnDef<T>[];
    /** Row data array */
    data: T[];
    /** Total count (for pagination, may differ from data.length) */
    totalCount?: number;
    /** Available quick/advanced filters */
    filters?: FilterDef[];
    /** Row action buttons */
    actions?: ActionDef<T>[];
    /** Add button configuration */
    addButton?: {
        label: string;
        onClick: () => void;
    };
    /** Whether rows can be expanded */
    expandable?: boolean;
    /** Render function for expanded row content */
    renderExpanded?: (row: T) => ReactNode;
    /** Export handler */
    onExport?: () => void;
    /** Loading state */
    loading?: boolean;
    /** Callback when filters/search/pagination change */
    onParamsChange?: (params: ListParams) => void;
    /** Row key extractor */
    rowKey?: (row: T) => string | number;
    /** Whether to show checkbox selection column */
    selectable?: boolean;
    /** Callback when selection changes */
    onSelectionChange?: (selectedRows: T[]) => void;
    /** Bulk action buttons (shown when rows are selected) */
    bulkActions?: { label: string; onClick: (rows: T[]) => void; variant?: string }[];
}

/**
 * Parameters passed to onParamsChange when user interacts with the list.
 */
export interface ListParams {
    search: string;
    filters: Record<string, any>;
    page: number;
    pageSize: number;
    sortColumn: string;
    sortDirection: 'asc' | 'desc';
}

/**
 * List preferences from backend.
 */
export interface ListPreferences {
    source: 'user' | 'organization' | 'default';
    list_key: string;
    visible_columns: string[];
    default_filters: Record<string, any>;
    page_size: number;
    sort_column: string;
    sort_direction: 'asc' | 'desc';
}
