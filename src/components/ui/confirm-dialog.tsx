'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Trash2, Info, ShieldAlert, Package, Barcode } from 'lucide-react'

type Variant = 'danger' | 'warning' | 'info' | 'critical'

export interface ConfirmImpact {
    /** e.g. "42 products will be reassigned to another category" */
    message?: string
    /** Count of affected records — drives the severity chip. */
    affectedCount?: number
    /** Count of affected records with active barcodes — stronger warning. */
    barcodeCount?: number
}

interface ConfirmDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void | Promise<void>
    title?: string
    description?: string
    confirmText?: string
    cancelText?: string
    variant?: Variant
    loading?: boolean
    /** Optional impact summary — renders a banner between description and
     *  footer with the affected count + barcode severity, matching the
     *  DeleteConflictDialog pattern for consistency. */
    impact?: ConfirmImpact
    /** When true + variant='critical', requires the user to click Confirm
     *  twice (first click changes the label to "Click again to confirm"). */
    doubleConfirm?: boolean
}

const variantConfig: Record<Variant, { icon: typeof AlertTriangle; color: string }> = {
    danger:   { icon: Trash2,        color: 'var(--app-error)' },
    warning:  { icon: AlertTriangle, color: 'var(--app-warning)' },
    info:     { icon: Info,          color: 'var(--app-info)' },
    critical: { icon: ShieldAlert,   color: 'var(--app-error)' },
}

export function ConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    title = 'Are you sure?',
    description = 'This action cannot be undone.',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    loading = false,
    impact,
    doubleConfirm = false,
}: ConfirmDialogProps) {
    const [isRunning, setIsRunning] = useState(false)
    const [armed, setArmed] = useState(false)  // critical-variant double-click state
    const cfg = variantConfig[variant]
    const Icon = cfg.icon
    const isCritical = variant === 'critical'
    const needsDouble = doubleConfirm || isCritical

    const handleConfirm = async () => {
        if (needsDouble && !armed) {
            setArmed(true)
            return
        }
        setIsRunning(true)
        try {
            await onConfirm()
        } finally {
            setIsRunning(false)
            setArmed(false)
        }
    }

    const busy = loading || isRunning
    const hasImpact = impact && ((impact.affectedCount ?? 0) > 0 || !!impact.message)

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) setArmed(false); onOpenChange(o) }}>
            <DialogContent className="sm:max-w-md rounded-2xl z-[115]"
                style={{
                    background: 'var(--app-surface)',
                    border: isCritical
                        ? `1px solid color-mix(in srgb, ${cfg.color} 45%, var(--app-border))`
                        : '1px solid var(--app-border)',
                    boxShadow: isCritical ? `0 20px 60px color-mix(in srgb, ${cfg.color} 20%, rgba(0,0,0,0.4))` : undefined,
                }}>
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${cfg.color} ${isCritical ? 15 : 10}%, transparent)`, color: cfg.color }}>
                            <Icon size={20} />
                        </div>
                        <DialogTitle className="text-[15px] font-black" style={{ color: 'var(--app-foreground)' }}>{title}</DialogTitle>
                    </div>
                    <DialogDescription className="mt-2 text-[12px] font-medium leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                        {description}
                    </DialogDescription>
                </DialogHeader>

                {/* Impact summary — affected records + barcode severity */}
                {hasImpact && (
                    <div className="mt-2 px-3 py-2 rounded-xl flex items-start gap-2"
                        style={{
                            background: `color-mix(in srgb, ${cfg.color} 6%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${cfg.color} 25%, transparent)`,
                        }}>
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />
                        <div className="flex-1 min-w-0 space-y-1">
                            {impact!.message && (
                                <p className="text-[11px] font-bold leading-tight" style={{ color: cfg.color }}>
                                    {impact!.message}
                                </p>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {(impact!.affectedCount ?? 0) > 0 && (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                        style={{ background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`, color: cfg.color }}>
                                        <Package size={9} />{impact!.affectedCount} affected
                                    </span>
                                )}
                                {(impact!.barcodeCount ?? 0) > 0 && (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                        style={{ background: 'color-mix(in srgb, var(--app-error) 12%, transparent)', color: 'var(--app-error)' }}>
                                        <Barcode size={9} />{impact!.barcodeCount} with barcode
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="mt-4 gap-2">
                    <Button
                        variant="outline"
                        onClick={() => { setArmed(false); onOpenChange(false) }}
                        disabled={busy}
                        className="rounded-xl text-[11px] font-bold"
                        style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={busy}
                        className="rounded-xl text-[11px] font-bold"
                        style={{
                            background: armed ? cfg.color : cfg.color,
                            color: 'white',
                            boxShadow: armed ? `0 0 0 3px color-mix(in srgb, ${cfg.color} 30%, transparent)` : undefined,
                        }}
                    >
                        {busy ? 'Processing...' : armed ? 'Click again to confirm' : confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
