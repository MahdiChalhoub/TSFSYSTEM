import { Clock, CheckCircle2, XCircle, PlayCircle, Ban, ShoppingCart, ArrowRightLeft } from 'lucide-react'
import type {
    ProcurementRequestStatus, ProcurementRequestType, ProcurementRequestPriority,
} from '@/app/actions/inventory/procurement-requests'

export const STATUS_META: Record<ProcurementRequestStatus, { label: string; color: string; icon: typeof Clock }> = {
    PENDING:   { label: 'Pending',   color: 'var(--app-warning, #f59e0b)', icon: Clock },
    APPROVED:  { label: 'Approved',  color: 'var(--app-info, #3b82f6)',    icon: CheckCircle2 },
    EXECUTED:  { label: 'Executed',  color: 'var(--app-success, #22c55e)', icon: PlayCircle },
    REJECTED:  { label: 'Rejected',  color: 'var(--app-error, #ef4444)',   icon: XCircle },
    CANCELLED: { label: 'Cancelled', color: 'var(--app-muted-foreground)', icon: Ban },
}

export const TYPE_META: Record<ProcurementRequestType, { label: string; color: string; icon: typeof ShoppingCart }> = {
    PURCHASE: { label: 'Purchase', color: 'var(--app-info, #3b82f6)',    icon: ShoppingCart },
    TRANSFER: { label: 'Transfer', color: 'var(--app-warning, #f59e0b)', icon: ArrowRightLeft },
}

export const PRIORITY_META: Record<ProcurementRequestPriority, { label: string; color: string }> = {
    LOW:    { label: 'Low',    color: 'var(--app-muted-foreground)' },
    NORMAL: { label: 'Normal', color: 'var(--app-info, #3b82f6)' },
    HIGH:   { label: 'High',   color: 'var(--app-warning, #f59e0b)' },
    URGENT: { label: 'Urgent', color: 'var(--app-error, #ef4444)' },
}
