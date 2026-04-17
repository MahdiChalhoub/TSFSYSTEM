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
    points: number;
    due_date?: string;
    is_overdue?: boolean;
    subtask_count: number;
    related_object_label?: string;
    is_recurring?: boolean;
    recurrence_days?: number;
    created_at: string;
}

export interface Category {
    id: number;
    name: string;
    color: string;
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
    AWAITING_RESPONSE: '#8b5cf6',
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
