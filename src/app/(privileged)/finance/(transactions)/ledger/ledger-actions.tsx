'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Edit2, RotateCcw, Eye, Lock, Unlock, ShieldCheck, CheckCircle2, History } from 'lucide-react'
import { toast } from 'sonner'
import { reverseJournalEntry, lockJournalEntry, unlockJournalEntry, verifyJournalEntry, confirmJournalEntry, getJournalEntryHistory } from '@/app/actions/finance/ledger'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function LedgerEntryActions({
    entryId,
    status,
    lifecycleStatus,
    isLocked,
    onActionComplete
}: {
    entryId: number,
    status: string,
    lifecycleStatus: string,
    isLocked: boolean,
    onActionComplete?: () => void
}) {
    const [isPending, startTransition] = useTransition()
    const [showReverse, setShowReverse] = useState(false)
    const [commentOpen, setCommentOpen] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [historyData, setHistoryData] = useState<any[]>([])
    const router = useRouter()

    const handleReverse = async () => {
        startTransition(async () => {
            try {
                await reverseJournalEntry(entryId)
                toast.success("Entry reversed")
                onActionComplete?.()
                router.refresh()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)))
            }
        })
        setShowReverse(false)
    }

    const handleLock = () => {
        startTransition(async () => {
            try {
                await lockJournalEntry(entryId)
                toast.success("Entry locked")
                onActionComplete?.()
            } catch (err: unknown) {
                toast.error(String(err))
            }
        })
    }

    const handleUnlock = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const comment = fd.get('comment') as string
        startTransition(async () => {
            try {
                await unlockJournalEntry(entryId, comment)
                toast.success("Entry unlocked")
                setCommentOpen(false)
                onActionComplete?.()
            } catch (err: unknown) {
                toast.error(String(err))
            }
        })
    }

    const handleVerify = () => {
        startTransition(async () => {
            try {
                await verifyJournalEntry(entryId)
                toast.success("Entry verified")
                onActionComplete?.()
            } catch (err: unknown) {
                toast.error(String(err))
            }
        })
    }

    const handleConfirm = () => {
        startTransition(async () => {
            try {
                await confirmJournalEntry(entryId)
                toast.success("Entry confirmed")
                onActionComplete?.()
            } catch (err: unknown) {
                toast.error(String(err))
            }
        })
    }

    const showHistory = async () => {
        try {
            const history = await getJournalEntryHistory(entryId)
            setHistoryData(history)
            setHistoryOpen(true)
        } catch {
            toast.error("Failed to load history")
        }
    }

    const isOpen = lifecycleStatus === 'OPEN'
    const isLclLocked = lifecycleStatus === 'LOCKED'
    const isVerified = lifecycleStatus === 'VERIFIED'
    const isConfirmed = lifecycleStatus === 'CONFIRMED'

    return (
        <div className="flex gap-1 items-center">
            {/* Standard Actions */}
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
                    onClick={() => setShowReverse(true)}
                    disabled={isPending || (lifecycleStatus !== 'OPEN' && lifecycleStatus !== 'CONFIRMED')}
                    className="p-1.5 hover:bg-rose-50 rounded text-rose-500 disabled:opacity-30"
                    title="Reverse Entry"
                >
                    <RotateCcw size={14} />
                </button>
            )}

            {/* Lifecycle Actions */}
            {isOpen && status !== 'REVERSED' && (
                <Button size="sm" variant="ghost" onClick={handleLock} disabled={isPending} className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg">
                    <Lock size={14} className="mr-1" /> Lock
                </Button>
            )}

            {isLclLocked && (
                <>
                    <Button size="sm" variant="ghost" onClick={() => setCommentOpen(true)} disabled={isPending} className="h-8 px-2 text-stone-500 hover:bg-stone-50 rounded-lg">
                        <Unlock size={14} className="mr-1" /> Unlock
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleVerify} disabled={isPending} className="h-8 px-2 text-purple-600 hover:bg-purple-50 rounded-lg">
                        <ShieldCheck size={14} className="mr-1" /> Verify
                    </Button>
                </>
            )}

            {isVerified && (
                <Button size="sm" variant="ghost" onClick={handleConfirm} disabled={isPending} className="h-8 px-2 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                    <CheckCircle2 size={14} className="mr-1" /> Confirm
                </Button>
            )}

            <button
                onClick={() => router.push(`/finance/ledger/${entryId}`)}
                className="p-1.5 hover:bg-stone-100 rounded text-stone-500"
                title="View Details"
            >
                <Eye size={14} />
            </button>

            <button
                onClick={showHistory}
                className="p-1.5 hover:bg-stone-100 rounded text-stone-400"
                title="Lifecycle History"
            >
                <History size={14} />
            </button>

            {/* Dialogs */}
            <ConfirmDialog
                open={showReverse}
                onOpenChange={setShowReverse}
                onConfirm={handleReverse}
                title="Reverse Entry?"
                description="This will create a mirrored transaction to cancel out the balances. This action cannot be undone."
                confirmText="Reverse"
                variant="warning"
            />

            <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Unlock size={18} /> Unlock Entry</DialogTitle>
                        <DialogDescription>Provide a reason for unlocking this journal entry.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUnlock} className="space-y-4">
                        <Input name="comment" required placeholder="Reason for unlocking..." className="rounded-xl" />
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setCommentOpen(false)} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={isPending} className="rounded-xl">Unlock</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><History size={18} /> Lifecycle History</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-80 overflow-y-auto space-y-2 mt-4">
                        {historyData.length === 0 && <p className="text-center text-stone-400 py-4">No history records.</p>}
                        {historyData.map((h, i) => (
                            <div key={i} className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                                <p className="text-sm font-bold text-stone-800">{h.action}</p>
                                {h.comment && <p className="text-xs text-stone-500 mt-1 italic">"{h.comment}"</p>}
                                <p className="text-[10px] text-stone-400 mt-2">
                                    By {h.performed_by || 'Unknown'} on {new Date(h.performed_at).toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}