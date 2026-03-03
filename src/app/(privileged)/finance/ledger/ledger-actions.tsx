'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Edit2, RotateCcw, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { reverseJournalEntry } from '@/app/actions/finance/ledger'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function LedgerEntryActions({ entryId, status, isLocked }: { entryId: number, status: string, isLocked: boolean }) {
 const [isPending, startTransition] = useTransition()
 const [showReverse, setShowReverse] = useState(false)
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
 </div>
 )
}