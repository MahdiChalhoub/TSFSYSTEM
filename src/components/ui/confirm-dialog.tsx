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
import { AlertTriangle, Trash2, Info } from 'lucide-react'

type Variant = 'danger' | 'warning' | 'info'

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
}

const variantConfig: Record<Variant, { icon: typeof AlertTriangle; color: string }> = {
    danger:  { icon: Trash2,        color: 'var(--app-error)' },
    warning: { icon: AlertTriangle, color: 'var(--app-warning)' },
    info:    { icon: Info,          color: 'var(--app-info)' },
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
}: ConfirmDialogProps) {
    const [isRunning, setIsRunning] = useState(false)
    const cfg = variantConfig[variant]
    const Icon = cfg.icon

    const handleConfirm = async () => {
        setIsRunning(true)
        try {
            await onConfirm()
        } finally {
            setIsRunning(false)
        }
    }

    const busy = loading || isRunning

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`, color: cfg.color }}>
                            <Icon size={20} />
                        </div>
                        <DialogTitle className="text-[15px] font-black" style={{ color: 'var(--app-foreground)' }}>{title}</DialogTitle>
                    </div>
                    <DialogDescription className="mt-2 text-[12px] font-medium leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4 gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
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
                        style={{ background: cfg.color, color: 'white' }}
                    >
                        {busy ? 'Processing...' : confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
