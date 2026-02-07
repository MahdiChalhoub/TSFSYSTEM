'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Edit2, RotateCcw, Eye } from 'lucide-react'
import { reverseJournalEntry } from '@/app/actions/finance/ledger'

export function LedgerEntryActions({ entryId, status, isLocked }: { entryId: number, status: string, isLocked: boolean }) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleReverse = async () => {
        if (!confirm('Are you sure you want to reverse this entry? This will create a mirrored transaction to cancel out the balances.')) return

        startTransition(async () => {
            try {
                await reverseJournalEntry(entryId)
                router.refresh()
            } catch (err: any) {
                alert(err.message)
            }
        })
    }

    return (
        <div className="flex gap-2">
            <button
                onClick={() => router.push(`/finance/ledger/${entryId}/edit`)}
                disabled={isLocked || status === 'REVERSED'}
                className="p-1.5 hover:bg-stone-100 rounded text-stone-500 disabled:opacity-30"
                title="Edit Entry"
            >
                <Edit2 size={14} />
            </button>

            {status === 'POSTED' && (
                <button
                    onClick={handleReverse}
                    disabled={isPending || isLocked}
                    className="p-1.5 hover:bg-rose-50 rounded text-rose-500 disabled:opacity-30"
                    title="Reverse Entry"
                >
                    <RotateCcw size={14} />
                </button>
            )}

            <button
                onClick={() => router.push(`/finance/ledger/${entryId}`)}
                className="p-1.5 hover:bg-stone-100 rounded text-stone-500"
                title="View Details"
            >
                <Eye size={14} />
            </button>
        </div>
    )
}