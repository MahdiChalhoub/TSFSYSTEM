'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RefreshCcw, Lock, Check, AlertTriangle, BookOpen, X } from 'lucide-react'

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void | Promise<void>
}

export function RecalculateBalancesDialog({ open, onOpenChange, onConfirm }: Props) {
    const [running, setRunning] = useState(false)

    const handleConfirm = async () => {
        setRunning(true)
        try {
            await onConfirm()
        } finally {
            setRunning(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="w-[calc(100vw-2rem)] sm:max-w-[520px] max-h-[90vh] rounded-2xl z-[115] p-0 overflow-hidden flex flex-col"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 40%, var(--app-border))',
                    boxShadow: '0 20px 60px color-mix(in srgb, var(--app-warning, #f59e0b) 18%, rgba(0,0,0,0.4))',
                }}
            >
                {/* ── Header bar ───────────────────────────────────────── */}
                <DialogHeader
                    className="px-4 sm:px-5 py-3 sm:py-4 flex-row items-center gap-3 space-y-0 flex-shrink-0"
                    style={{
                        borderBottom: '1px solid var(--app-border)',
                        background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)',
                    }}
                >
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 14%, transparent)',
                            color: 'var(--app-warning, #f59e0b)',
                        }}
                    >
                        <RefreshCcw size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <DialogTitle
                            className="text-[15px] font-black leading-tight"
                            style={{ color: 'var(--app-foreground)' }}
                        >
                            Recalculate balances?
                        </DialogTitle>
                        <p
                            className="text-[10px] font-bold uppercase tracking-[0.06em] mt-0.5"
                            style={{ color: 'var(--app-muted-foreground)' }}
                        >
                            Audit · rebuild from journal entries
                        </p>
                    </div>
                </DialogHeader>

                {/* ── Body — three structured sections (scrolls on short screens) ── */}
                <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4 flex-1 overflow-y-auto">
                    {/* What this does */}
                    <Section
                        icon={BookOpen}
                        color="var(--app-info, #3b82f6)"
                        title="What this does"
                        body="Wipes every account's cached balance and replays every POSTED journal entry from the very first one to the most recent. The entries themselves (date, amounts, accounts) are unchanged — only the running totals are rebuilt to match the journal history exactly."
                    />

                    {/* What's protected */}
                    <Section
                        icon={Lock}
                        color="var(--app-success, #22c55e)"
                        title="Closed years are protected"
                        body="Closed fiscal periods reject re-posting. The moment the replay touches an entry inside a CLOSED period, the whole operation aborts and rolls back atomically — no balance is changed. Snapshots are immune either way (they store their own frozen trial balance)."
                    >
                        <ul className="mt-1.5 space-y-1 text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>
                            <li className="flex items-center gap-1.5">
                                <Check size={10} style={{ color: 'var(--app-success, #22c55e)' }} />
                                Snapshots stay intact (frozen at close time)
                            </li>
                            <li className="flex items-center gap-1.5">
                                <Check size={10} style={{ color: 'var(--app-success, #22c55e)' }} />
                                Journal entry content (date, amounts) untouched
                            </li>
                            <li className="flex items-center gap-1.5">
                                <Check size={10} style={{ color: 'var(--app-success, #22c55e)' }} />
                                Atomic — if anything fails, nothing changes
                            </li>
                        </ul>
                    </Section>

                    {/* When NOT to use */}
                    <Section
                        icon={AlertTriangle}
                        color="var(--app-warning, #f59e0b)"
                        title="Don't use this on a closed-year org"
                        body="If you have any CLOSED fiscal periods, this will fail at the first one and revert. It's only useful on an org with no closed years yet — typically right after migration, data import, or manual fixes you want to verify against the journal source of truth."
                    />
                </div>

                {/* ── Footer ───────────────────────────────────────────── */}
                <DialogFooter
                    className="px-4 sm:px-5 py-3 gap-2 flex-shrink-0 flex-row sm:justify-end"
                    style={{
                        borderTop: '1px solid var(--app-border)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}
                >
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={running}
                        className="flex-1 sm:flex-none rounded-xl text-[12px] sm:text-[11px] font-bold gap-1.5 h-10 sm:h-9"
                        style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}
                    >
                        <X size={13} /> Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={running}
                        className="flex-1 sm:flex-none rounded-xl text-[12px] sm:text-[11px] font-bold gap-1.5 h-10 sm:h-9"
                        style={{
                            background: 'var(--app-warning, #f59e0b)',
                            color: 'white',
                            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)',
                        }}
                    >
                        <RefreshCcw size={13} className={running ? 'animate-spin' : ''} />
                        {running ? 'Recalculating…' : 'Recalculate'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function Section({
    icon: Icon,
    color,
    title,
    body,
    children,
}: {
    icon: typeof BookOpen
    color: string
    title: string
    body: string
    children?: React.ReactNode
}) {
    return (
        <div
            className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
            style={{
                background: `color-mix(in srgb, ${color} 4%, transparent)`,
                border: `1px solid color-mix(in srgb, ${color} 18%, transparent)`,
            }}
        >
            <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
            >
                <Icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[12px] font-black leading-tight" style={{ color }}>
                    {title}
                </div>
                <div className="mt-1 text-[11px] leading-relaxed font-medium" style={{ color: 'var(--app-foreground)' }}>
                    {body}
                </div>
                {children}
            </div>
        </div>
    )
}
