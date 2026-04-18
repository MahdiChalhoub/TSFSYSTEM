'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Edit2, RotateCcw, Eye, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { reverseJournalEntry, deleteJournalEntry } from '@/app/actions/finance/ledger'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface LedgerEntryActionsProps {
    entryId: number
    status: string
    isLocked: boolean
    onDeleted?: () => void
}

export function LedgerEntryActions({ entryId, status, isLocked, onDeleted }: LedgerEntryActionsProps) {
    const [isPending, startTransition] = useTransition()
    const [showReverse, setShowReverse] = useState(false)
    const [showDelete, setShowDelete] = useState(false)
    const router = useRouter()

    const handleReverse = async () => {
        startTransition(async () => {
            try {
                await reverseJournalEntry(entryId)
                router.refresh()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)))
            }
        })
        setShowReverse(false)
    }

    const handleDelete = async () => {
        startTransition(async () => {
            try {
                await deleteJournalEntry(entryId)
                toast.success('Journal entry deleted')
                onDeleted?.()
                router.refresh()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)))
            }
        })
        setShowDelete(false)
    }

    // Delete is allowed only for DRAFT or REVERSED entries on unlocked fiscal years
    const canDelete = status !== 'POSTED' && !isLocked

    return (
        <div className="flex gap-2">
            <button
                onClick={() => router.push(`/finance/ledger/${entryId}/edit`)}
                disabled={isLocked || status === 'REVERSED'}
                className="p-1.5 hover:bg-app-surface-2 rounded text-app-muted-foreground disabled:opacity-30"
                title="Edit Entry"
            >
                <Edit2 size={14} />
            </button>

            {status === 'POSTED' && (
                <button
                    onClick={() => setShowReverse(true)}
                    disabled={isPending || isLocked}
                    className="p-1.5 hover:bg-rose-50 rounded text-rose-500 disabled:opacity-30"
                    title="Reverse Entry"
                >
                    <RotateCcw size={14} />
                </button>
            )}

            {canDelete && (
                <button
                    onClick={() => setShowDelete(true)}
                    disabled={isPending}
                    className="p-1.5 hover:bg-rose-50 rounded text-rose-500 disabled:opacity-30"
                    title="Delete Entry"
                >
                    <Trash2 size={14} />
                </button>
            )}

            <button
                onClick={() => router.push(`/finance/ledger/${entryId}`)}
                className="p-1.5 hover:bg-app-surface-2 rounded text-app-muted-foreground"
                title="View Details"
            >
                <Eye size={14} />
            </button>

            <ConfirmDialog
                open={showReverse}
                onOpenChange={setShowReverse}
                onConfirm={handleReverse}
                title="Reverse Entry?"
                description="This will create a mirrored transaction to cancel out the balances. This action cannot be undone."
                confirmText="Reverse"
                variant="warning"
            />

            <ConfirmDialog
                open={showDelete}
                onOpenChange={setShowDelete}
                onConfirm={handleDelete}
                title="Delete Journal Entry?"
                description={`This will permanently delete journal entry JV #${entryId} and all its lines. This action cannot be undone.`}
                confirmText="Delete"
                variant="destructive"
            />
        </div>
    )
}