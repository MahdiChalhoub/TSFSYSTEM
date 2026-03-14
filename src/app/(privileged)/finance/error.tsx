'use client'

import React, { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { AlertCircle, RotateCcw, Wallet } from "lucide-react"
import { reportError } from "@/lib/error-reporting"

export default function FinanceError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        reportError(error, 'error-boundary', { scope: 'finance' })
    }, [error])
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-app-background min-h-[60vh] rounded-2xl border border-app-border/50 shadow-sm relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500/20 via-rose-500/50 to-red-500/20" />

            <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex flex-col items-center justify-center text-red-500 mb-6 shadow-lg shadow-red-500/10 relative">
                <AlertCircle size={24} className="absolute -top-2 -right-2 text-red-500 bg-app-background rounded-full" />
                <Wallet size={36} className="text-red-400" />
            </div>

            <h2 className="text-3xl font-black text-app-foreground tracking-tight">
                Finance Module Error
            </h2>
            <p className="text-app-muted-foreground mt-3 font-medium max-w-md mx-auto leading-relaxed">
                An unexpected error occurred while loading this financial view. The ledger and underlying data remain secure.
            </p>

            <div className="mt-8 bg-app-surface border border-app-border/60 p-5 rounded-2xl max-w-lg w-full text-left shadow-sm">
                <p className="text-[10px] font-black text-rose-500/70 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <AlertCircle size={10} /> Technical Trace
                </p>
                <div className="text-xs font-mono text-app-muted-foreground break-all bg-app-background/50 p-4 rounded-xl border border-app-border/40 max-h-32 overflow-y-auto">
                    {error.message || "Unknown error context"}
                </div>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Button
                    onClick={() => reset()}
                    className="bg-app-primary hover:bg-app-primary/90 text-app-foreground px-8 py-6 rounded-2xl font-black shadow-lg shadow-app-primary/20 transition-all flex gap-3"
                >
                    <RotateCcw size={18} />
                    Reload View
                </Button>
                <Button
                    variant="outline"
                    onClick={() => window.location.href = '/finance/account-book'}
                    className="border-app-border bg-app-surface hover:bg-app-surface-hover text-app-muted-foreground px-8 py-6 rounded-2xl font-black transition-all"
                >
                    Back to Ledger
                </Button>
            </div>
        </div>
    )
}
