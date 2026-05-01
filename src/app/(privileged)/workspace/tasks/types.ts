import { Clock, Play, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Task {
    id: number;
    title: string;
    description?: string;
    status: string;
    priority: string;
    source: string;
    category?: number;
    category_name?: string;
    assigned_to?: number;
    assigned_to_name?: string;
    assigned_by?: number;
    assigned_by_name?: string;
    points: number;
    due_date?: string;
    is_overdue?: boolean;
    subtask_count: number;
    related_object_label?: string;
    related_object_type?: string;
    related_object_id?: number;
    completed_at?: string | null;
    completed_by?: number | null;
    completed_by_name?: string | null;
    completion_note?: string | null;
    require_completion_note?: boolean;
    completion_checklist?: ChecklistItem[];
    remind_until_done?: boolean;
    remind_interval_min?: number;
    attachments?: TaskAttachmentShort[];
    is_recurring?: boolean;
    recurrence_days?: number;
    created_at: string;
}

/** Maps a task's related_object_type to an in-app deep link so the assignee
 * can jump from the task straight to the source record (invoice, product,
 * fiscal period, etc.).
 *
 * Every link carries `?from_task=<task_id>` so the destination page can
 * 1) highlight the target record,
 * 2) open the relevant action modal (e.g. the Reopen Period confirm),
 * 3) call `POST /api/tasks/{id}/complete/` after the native action succeeds,
 *    auto-closing the task without the user needing a separate click.
 *
 * Returns null for unknown types. */
export function resolveTaskSourceLink(t: Task): { href: string; label: string } | null {
    const type = (t.related_object_type || '').toLowerCase()
    const id = t.related_object_id
    if (!type) return null
    const q = (extra: Record<string, string | number | undefined>): string => {
        const parts: string[] = []
        parts.push(`from_task=${t.id}`)
        for (const [k, v] of Object.entries(extra)) {
            if (v !== undefined && v !== null && v !== '') parts.push(`${k}=${encodeURIComponent(String(v))}`)
        }
        return '?' + parts.join('&')
    }
    switch (type) {
        case 'fiscalperiod':
        case 'fiscal_period':
            return { href: `/finance/fiscal-years${q({ period: id })}`, label: 'Open Fiscal Year' }
        case 'fiscalyear':
        case 'fiscal_year':
            return { href: `/finance/fiscal-years${q({ year: id })}`, label: 'Open Fiscal Year' }
        case 'journalentry':
        case 'journal_entry':
            return { href: `/finance/ledger${q({ focus: id })}`, label: 'Open Journal Entry' }
        case 'invoice':
            return { href: id ? `/finance/invoices/${id}${q({})}` : `/finance/invoices${q({})}`, label: 'Open Invoice' }
        case 'product':
            return { href: id ? `/inventory/products/${id}${q({})}` : `/inventory/products${q({})}`, label: 'Open Product' }
        case 'purchaseorder':
        case 'purchase_order':
            return { href: id ? `/purchases/${id}${q({})}` : `/purchases${q({})}`, label: 'Open Purchase Order' }
        case 'customer':
        case 'contact':
            return { href: id ? `/crm/contacts/${id}${q({})}` : `/crm/contacts${q({})}`, label: 'Open Customer' }
        case 'supplier':
            return { href: id ? `/crm/suppliers/${id}${q({})}` : `/crm/suppliers${q({})}`, label: 'Open Supplier' }
        case 'stockledger':
        case 'stock_ledger':
            return { href: `/inventory/stock-matrix${q({})}`, label: 'Open Stock' }
        case 'order':
        case 'sale':
            return { href: id ? `/sales/orders/${id}${q({})}` : `/sales/orders${q({})}`, label: 'Open Order' }
        default:
            return null
    }
}

export interface Category {
    id: number;
    name: string;
    color: string;
    leader?: number | null;
    leader_name?: string | null;
}

export interface ChecklistItem {
    label: string;
    checked: boolean;
}

export interface TaskAttachmentShort {
    id: number;
    filename: string;
    file: string; // URL path returned by DRF FileField
    uploaded_by?: number | null;
    created_at?: string | null;
}

export interface UserItem {
    id: number;
    email: string;
    username: string;
    first_name?: string;
    last_name?: string;
}

export interface Dashboard {
    total_assigned?: number;
    pending?: number;
    in_progress?: number;
    completed?: number;
    overdue?: number;
    assigned_by_me?: number;
}

export type CategorySelection = 'all' | null | number;
export type StatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

export const STATUS_ICONS: Record<string, any> = {
    PENDING: Clock,
    IN_PROGRESS: Play,
    COMPLETED: CheckCircle2,
    CANCELLED: XCircle,
    OVERDUE: AlertTriangle,
};

export const STATUS_COLOR: Record<string, string> = {
    PENDING: 'var(--app-warning, #f59e0b)',
    IN_PROGRESS: 'var(--app-info, #3b82f6)',
    AWAITING_RESPONSE: 'var(--app-accent)',
    COMPLETED: 'var(--app-success, #22c55e)',
    CANCELLED: 'var(--app-muted-foreground)',
    OVERDUE: 'var(--app-error, #ef4444)',
};

export const PRIORITY_COLOR: Record<string, string> = {
    URGENT: 'var(--app-error, #ef4444)',
    HIGH: 'var(--app-warning, #f59e0b)',
    MEDIUM: 'var(--app-info, #3b82f6)',
    LOW: 'var(--app-muted-foreground)',
};

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

export function getUserName(u: UserItem): string {
    return u.first_name && u.last_name
        ? `${u.first_name} ${u.last_name}`
        : u.email || u.username || 'Unknown';
}
