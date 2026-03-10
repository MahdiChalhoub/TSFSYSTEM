'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AlertTriangle, Settings, ArrowRight } from 'lucide-react'

type SetupState = {
    status: string
}

// Pages that are always allowed even when setup is incomplete
const ALWAYS_ALLOWED = [
    '/finance/setup',
    '/finance/chart-of-accounts/templates',
    '/finance/chart-of-accounts/migrate',
    '/finance/settings/posting-rules',
]

export function FinanceSetupGuard({ children, setupState }: { children: React.ReactNode; setupState: SetupState }) {
    const router = useRouter()
    const pathname = usePathname()

    // If setup is complete, render children normally
    if (setupState.status === 'COMPLETED') {
        return <>{children}</>
    }

    // If we're on an allowed page, render it
    if (ALWAYS_ALLOWED.some(path => pathname.startsWith(path))) {
        return <>{children}</>
    }

    // Otherwise, show the setup required banner
    return (
        <div className="app-page p-6 space-y-6">
            <div className="max-w-2xl mx-auto p-8 rounded-2xl text-center space-y-5"
                style={{ background: 'var(--app-card)', border: '1px solid var(--app-warning)40' }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                    style={{ background: 'var(--app-warning)15', border: '2px solid var(--app-warning)30' }}>
                    <AlertTriangle size={32} style={{ color: 'var(--app-warning)' }} />
                </div>
                <h2 className="text-2xl font-black" style={{ color: 'var(--app-foreground)' }}>
                    Finance Setup Required
                </h2>
                <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--app-muted-foreground)' }}>
                    Your Chart of Accounts has not been configured yet. Please complete the setup wizard
                    before using finance features like journal entries, payments, or invoicing.
                </p>
                <div className="flex justify-center gap-3 pt-3">
                    <button
                        onClick={() => router.push('/finance/setup')}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all"
                        style={{ background: 'var(--app-primary)', color: 'white' }}
                    >
                        <Settings size={16} /> Start Setup Wizard <ArrowRight size={16} />
                    </button>
                </div>
                <p className="text-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                    Current status: <strong>{setupState.status.replace(/_/g, ' ')}</strong>
                </p>
            </div>
        </div>
    )
}
