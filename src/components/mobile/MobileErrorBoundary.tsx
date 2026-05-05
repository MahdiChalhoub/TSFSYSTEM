'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCcw, ArrowLeft } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
 *  MobileErrorBoundary — fail-soft error UI for mobile clients.
 *  Catches render-phase errors in the wrapped tree and shows a
 *  retry / back card instead of a blank body.
 * ═══════════════════════════════════════════════════════════ */

interface Props {
    children: ReactNode
    /** If provided, called when the user taps "Try again" so the
     *  parent can reset state (e.g., refetch). Defaults to reload. */
    onReset?: () => void
    /** Label for the parent route; back button navigates there. */
    backHref?: string
    backLabel?: string
}

interface State {
    error: Error | null
}

export class MobileErrorBoundary extends Component<Props, State> {
    state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    componentDidCatch(error: Error, info: any) {
        // Surface to the browser console so logs are reachable.
        console.error('[MobileErrorBoundary]', error, info)
    }

    handleRetry = () => {
        this.setState({ error: null })
        if (this.props.onReset) this.props.onReset()
        else if (typeof window !== 'undefined') window.location.reload()
    }

    render() {
        if (!this.state.error) return this.props.children

        const { backHref = '/dashboard', backLabel = 'Go to Dashboard' } = this.props
        const msg = this.state.error.message || 'Unknown error'

        return (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center"
                style={{ minHeight: 'calc(100dvh - var(--mobile-chrome, 0px))' }}>
                <div className="flex items-center justify-center rounded-full mb-4"
                    style={{
                        width: 64, height: 64,
                        background: 'color-mix(in srgb, var(--app-error, #ef4444) 12%, transparent)',
                        color: 'var(--app-error, #ef4444)',
                    }}>
                    <AlertTriangle size={28} />
                </div>
                <h2 className="mb-1" style={{ fontSize: 'var(--tp-2xl)' }}>
                    Something went wrong
                </h2>
                <p className="font-bold text-app-muted-foreground max-w-xs mb-1"
                    style={{ fontSize: 'var(--tp-md)' }}>
                    The page hit an error while rendering.
                </p>
                <p className="font-mono truncate max-w-xs mb-5"
                    style={{
                        fontSize: 'var(--tp-xs)',
                        color: 'color-mix(in srgb, var(--app-error, #ef4444) 85%, var(--app-muted-foreground))',
                    }}>
                    {msg}
                </p>
                <div className="flex items-center gap-2 w-full max-w-xs">
                    <button
                        onClick={this.handleRetry}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl font-black active:scale-[0.98] transition-transform"
                        style={{
                            fontSize: 'var(--tp-md)',
                            height: 46,
                            color: '#fff',
                            background: 'var(--app-primary)',
                            boxShadow: '0 2px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        }}>
                        <RefreshCcw size={14} /> Try again
                    </button>
                    <a
                        href={backHref}
                        className="flex items-center justify-center gap-2 rounded-xl font-bold active:scale-[0.97] transition-transform flex-shrink-0"
                        style={{
                            fontSize: 'var(--tp-md)',
                            height: 46,
                            padding: '0 14px',
                            color: 'var(--app-muted-foreground)',
                            background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                        }}>
                        <ArrowLeft size={14} /> {backLabel}
                    </a>
                </div>
            </div>
        )
    }
}
