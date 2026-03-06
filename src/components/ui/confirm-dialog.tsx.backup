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

const variantStyles: Record<Variant, { icon: typeof AlertTriangle; iconClass: string; btnClass: string }> = {
    danger: {
        icon: Trash2,
        iconClass: 'text-app-error bg-app-error-bg',
        btnClass: 'bg-app-error hover:bg-app-error text-white',
    },
    warning: {
        icon: AlertTriangle,
        iconClass: 'text-app-warning bg-app-warning-bg',
        btnClass: 'bg-app-warning hover:bg-app-warning text-white',
    },
    info: {
        icon: Info,
        iconClass: 'text-app-info bg-app-info-bg',
        btnClass: 'bg-blue-600 hover:bg-blue-500 text-white',
    },
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
    const style = variantStyles[variant]
    const Icon = style.icon

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
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.iconClass}`}>
                            <Icon size={20} />
                        </div>
                        <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
                    </div>
                    <DialogDescription className="mt-2 text-sm text-app-text-faint leading-relaxed">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4 gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={busy}
                        className="rounded-xl"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={busy}
                        className={`rounded-xl ${style.btnClass}`}
                    >
                        {busy ? 'Processing...' : confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
