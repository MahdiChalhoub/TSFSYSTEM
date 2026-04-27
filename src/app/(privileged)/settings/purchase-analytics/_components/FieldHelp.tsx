'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { FIELD_HELP } from '../_lib/constants'

export function FieldHelp({ field }: { field: string }) {
    const [show, setShow] = useState(false)
    const help = FIELD_HELP[field]
    if (!help) return null
    return (
        <span className="relative inline-flex">
            <button type="button" className="text-app-muted-foreground/40 hover:text-app-primary transition-colors"
                onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onClick={() => setShow(!show)}>
                <Info size={9} />
            </button>
            {show && (
                <div className="absolute z-50 left-4 top-0 w-[200px] p-2 rounded-lg bg-app-surface border border-app-border shadow-xl text-[9px] text-app-muted-foreground leading-relaxed animate-[fadeIn_0.1s_ease-in-out]">
                    {help}
                </div>
            )}
        </span>
    )
}

export const statusDot = (status: 'ok' | 'warn' | 'error' | null) => {
    if (!status) return null
    const colors = { ok: 'bg-emerald-500', warn: 'bg-amber-500', error: 'bg-red-500' }
    return <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors[status]}`} />
}
