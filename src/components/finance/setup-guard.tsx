'use client'

import { useRouter, usePathname } from 'next/navigation'
import { AlertTriangle, Settings, ArrowRight } from 'lucide-react'

type SetupState = {
    status: string
}

// Pages that are always allowed even when setup is incomplete
const ALWAYS_ALLOWED = [
    '/finance/setup',
    '/finance/chart-of-accounts',
    '/finance/settings/posting-rules',
    '/finance/dashboard',
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

    // Otherwise, show the setup required banner ABOVE the children
    // This way the page still renders but with a prominent warning
    return (
        <div>
            <div className="mx-4 mt-4 p-4 rounded-xl flex items-center justify-between gap-4"
                style={{ background: 'var(--app-warning)12', border: '1px solid var(--app-warning)40' }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'var(--app-warning)20' }}>
                        <AlertTriangle size={20} style={{ color: 'var(--app-warning)' }} />
                    </div>
                    <div>
                        <p className="font-bold text-sm" style={{ color: 'var(--app-foreground)' }}>
                            COA Setup Required
                        </p>
                        <p className="text-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                            Complete the setup wizard to enable journal entries, payments, and invoicing.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => router.push('/finance/setup')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all shrink-0"
                    style={{ background: 'var(--app-primary)', color: 'white' }}
                >
                    <Settings size={14} /> Setup Wizard <ArrowRight size={14} />
                </button>
            </div>
            {children}
        </div>
    )
}
