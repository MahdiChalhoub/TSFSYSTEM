'use client'

import React, { useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import {
    AlertCircle, RotateCcw, ArrowLeft,
    ShoppingCart, Monitor, Users, Box, Truck, UserCog, Settings,
    Layout, Brain, Globe, HardDrive, Plug, Database, ExternalLink,
    Handshake, Bot, BarChart3, Shield, Store, Wand2, CheckCircle,
    LayoutDashboard, Wallet, PackageOpen, Building2, PackageCheck
} from "lucide-react"
import { reportError } from "@/lib/error-reporting"

/* ── Icon map — avoids passing React components through serialization ── */
const ICON_MAP: Record<string, React.ElementType> = {
    ShoppingCart, Monitor, Users, Box, Truck, UserCog, Settings,
    Layout, Brain, Globe, HardDrive, Plug, Database, ExternalLink,
    Handshake, Bot, BarChart3, Shield, Store, Wand2, CheckCircle,
    LayoutDashboard, Wallet, PackageOpen, Building2, PackageCheck,
    AlertCircle,
}

/* ── Chunk error detection ─────────────────────────────────────────── */
function isChunkError(error: Error): boolean {
    const msg = error.message || '';
    return msg.includes('load chunk') ||
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Loading CSS chunk') ||
        msg.includes('Failed to fetch dynamically imported module');
}

/* ── Cache cleanup utility ─────────────────────────────────────────── */
async function clearAllCaches(): Promise<void> {
    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(r => r.unregister()));
        }
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
    } catch (e) {
        console.warn('[ModuleErrorBoundary] Cache cleanup error:', e);
    }
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Shared Module Error Boundary
 *  — Self-healing chunk errors (clear SW + reload)
 *  — Sandboxed per-module crash display
 *  — Theme-engine compatible (--app-* variables)
 * ═══════════════════════════════════════════════════════════════════════ */
interface ModuleErrorBoundaryProps {
    error: Error & { digest?: string }
    reset: () => void
    /** Identifier for error reporting */
    scope: string
    /** Human-readable module name */
    label: string
    /** Key into ICON_MAP */
    icon?: string
    /** URL for the "Back to safety" button */
    fallbackUrl?: string
    /** Label for the fallback button */
    fallbackLabel?: string
    /** Accent color for the module icon badge */
    accentColor?: string
}

export function ModuleErrorBoundary({
    error, reset, scope, label,
    icon = 'AlertCircle',
    fallbackUrl = '/dashboard',
    fallbackLabel,
    accentColor = 'var(--app-error, #EF4444)',
}: ModuleErrorBoundaryProps) {
    const hasAttemptedRecovery = useRef(false);
    const Icon = ICON_MAP[icon] || AlertCircle;

    useEffect(() => {
        reportError(error, 'error-boundary', { scope })

        // Auto-recover from chunk load failures (stale SW cache)
        if (isChunkError(error) && !hasAttemptedRecovery.current) {
            hasAttemptedRecovery.current = true;
            console.warn(`[${scope}] Chunk load failure detected — clearing caches and reloading...`);
            clearAllCaches().then(() => window.location.reload());
        }
    }, [error, scope])

    const handleRetry = async () => {
        await clearAllCaches();
        window.location.reload();
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-app-background min-h-[60vh] rounded-2xl border border-app-border/50 shadow-sm relative overflow-hidden">
            {/* Top accent bar */}
            <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: `linear-gradient(90deg, transparent, ${accentColor}80, transparent)` }}
            />

            {/* Module icon badge */}
            <div
                className="w-20 h-20 rounded-3xl flex flex-col items-center justify-center mb-6 shadow-lg relative"
                style={{
                    backgroundColor: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
                    boxShadow: `0 8px 24px color-mix(in srgb, ${accentColor} 10%, transparent)`,
                }}
            >
                <AlertCircle
                    size={24}
                    className="absolute -top-2 -right-2 bg-app-background rounded-full"
                    style={{ color: 'var(--app-error, #EF4444)' }}
                />
                <Icon size={36} style={{ color: accentColor }} />
            </div>

            {/* Title */}
            <h2 className="text-3xl font-black text-app-foreground tracking-tight">
                {label} Module Error
            </h2>
            <p className="text-app-muted-foreground mt-3 font-medium max-w-md mx-auto leading-relaxed">
                An unexpected error occurred in the <strong>{label}</strong> module.
                Other modules remain unaffected and fully operational.
            </p>

            {/* Technical trace */}
            <div className="mt-8 bg-app-surface border border-app-border/60 p-5 rounded-2xl max-w-lg w-full text-left shadow-sm">
                <p
                    className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5"
                    style={{ color: `color-mix(in srgb, ${accentColor} 70%, transparent)` }}
                >
                    <AlertCircle size={10} /> Technical Trace — {scope}
                </p>
                <div className="text-xs font-mono text-app-muted-foreground break-all bg-app-background/50 p-4 rounded-xl border border-app-border/40 max-h-32 overflow-y-auto">
                    {error.message || "Unknown error context"}
                </div>
                {error.digest && (
                    <p className="text-[9px] font-mono text-app-muted-foreground mt-2 opacity-60">
                        Digest: {error.digest}
                    </p>
                )}
            </div>

            {/* Actions */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Button
                    onClick={handleRetry}
                    className="bg-app-primary hover:bg-app-primary/90 text-white px-8 py-6 rounded-2xl font-black shadow-lg shadow-app-primary/20 transition-all flex gap-3"
                >
                    <RotateCcw size={18} />
                    Try Again
                </Button>
                <Button
                    variant="outline"
                    onClick={() => window.location.href = fallbackUrl}
                    className="border-app-border bg-app-surface hover:bg-app-surface-hover text-app-muted-foreground px-8 py-6 rounded-2xl font-black transition-all flex gap-3"
                >
                    <ArrowLeft size={18} />
                    {fallbackLabel || `Back to ${label}`}
                </Button>
            </div>
        </div>
    )
}
