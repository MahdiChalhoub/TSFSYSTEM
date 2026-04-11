'use client'

/**
 * TaxExplanationDrawer
 * =====================
 * A slide-out panel that explains WHY a particular tax result was computed.
 * Shows the resolution path: which OrgTaxPolicy applied, which CounterpartyTaxProfile
 * matched, the scope, jurisdiction resolution, and each tax line's calculation.
 *
 * Usage:
 *   <TaxExplanationDrawer
 *     open={showDrawer}
 *     onClose={() => setShowDrawer(false)}
 *     taxResult={result}
 *     context={{ scope, policy, profile, jurisdiction }}
 *   />
 */

import { X, ChevronRight, Shield, Users, Globe, Calculator, Eye } from 'lucide-react'
import { TaxLinePreviewTable } from './TaxLinePreviewTable'

interface TaxResult {
    base_ht: number
    vat_amount: number
    total_ttc: number
    cost_official: number
    cost_internal?: number
    ap_amount?: number
    airsi_amount?: number
    tax_lines: Array<{
        type: string
        rate: number | string
        amount: number | string
        base_amount?: number | string
        behavior?: string
        name?: string
    }>
}

interface TaxContext {
    scope?: string
    policyName?: string
    profileName?: string
    jurisdictionCode?: string
    placeOfSupply?: string
    originCountry?: string
    destinationCountry?: string
    isExport?: boolean
}

interface TaxExplanationDrawerProps {
    open: boolean
    onClose: () => void
    taxResult?: TaxResult | null
    context?: TaxContext
}

function Step({ icon, title, value, sub }: { icon: React.ReactNode; title: string; value: string; sub?: string }) {
    return (
        <div className="flex items-start gap-3 py-2.5">
            <div className="mt-0.5 p-1.5 rounded-lg bg-app-accent/10" style={{ color: 'var(--app-accent)' }}>{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>{title}</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--app-foreground)' }}>{value}</div>
                {sub && <div className="text-[10px] mt-0.5" style={{ color: 'var(--app-muted)', opacity: 0.7 }}>{sub}</div>}
            </div>
            <ChevronRight size={14} style={{ color: 'var(--app-muted)', opacity: 0.3 }} className="mt-2 shrink-0" />
        </div>
    )
}

function fmt(v: number | string | undefined, fallback = '—') {
    if (v === undefined || v === null) return fallback
    const n = typeof v === 'string' ? parseFloat(v) : v
    return isNaN(n) ? fallback : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function TaxExplanationDrawer({ open, onClose, taxResult, context }: TaxExplanationDrawerProps) {
    if (!open) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 flex flex-col
        bg-app-background border-l border-white/5 shadow-2xl
        animate-in slide-in-from-right duration-300">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <Eye size={16} style={{ color: 'var(--app-accent)' }} />
                        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--app-foreground)' }}>
                            Tax Explanation
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                        <X size={16} style={{ color: 'var(--app-muted)' }} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {/* Resolution Path */}
                    {context && (
                        <div className="space-y-0 divide-y divide-white/5">
                            <h3 className="text-[10px] font-bold uppercase tracking-wider pb-2" style={{ color: 'var(--app-accent)' }}>
                                Resolution Path
                            </h3>
                            <Step
                                icon={<Shield size={12} />}
                                title="Tax Policy"
                                value={context.policyName || 'Default'}
                                sub={context.scope ? `Scope: ${context.scope}` : undefined}
                            />
                            <Step
                                icon={<Users size={12} />}
                                title="Counterparty Profile"
                                value={context.profileName || 'None'}
                                sub={context.isExport ? 'Export transaction' : undefined}
                            />
                            {context.jurisdictionCode && (
                                <Step
                                    icon={<Globe size={12} />}
                                    title="Jurisdiction"
                                    value={context.jurisdictionCode}
                                    sub={[
                                        context.placeOfSupply && `Supply: ${context.placeOfSupply}`,
                                        context.originCountry && `Origin: ${context.originCountry}`,
                                        context.destinationCountry && `→ ${context.destinationCountry}`,
                                    ].filter(Boolean).join(' · ')}
                                />
                            )}
                        </div>
                    )}

                    {/* Summary Metrics */}
                    {taxResult && (
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Base HT', value: fmt(taxResult.base_ht), accent: false },
                                { label: 'VAT', value: fmt(taxResult.vat_amount), accent: false },
                                { label: 'Total TTC', value: fmt(taxResult.total_ttc), accent: true },
                                { label: 'Cost (Official)', value: fmt(taxResult.cost_official), accent: false },
                                ...(taxResult.ap_amount ? [{ label: 'AP Amount', value: fmt(taxResult.ap_amount), accent: false }] : []),
                                ...(taxResult.airsi_amount ? [{ label: 'Withholding', value: fmt(taxResult.airsi_amount), accent: false }] : []),
                            ].map((m, i) => (
                                <div key={i} className="rounded-xl border border-white/5 bg-app-surface/30 p-3">
                                    <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--app-muted)' }}>{m.label}</div>
                                    <div className={`text-sm font-mono font-bold ${m.accent ? '' : ''}`}
                                        style={{ color: m.accent ? 'var(--app-accent)' : 'var(--app-foreground)' }}>
                                        {m.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tax Lines */}
                    {taxResult?.tax_lines && (
                        <TaxLinePreviewTable
                            taxLines={taxResult.tax_lines}
                            baseHT={taxResult.base_ht}
                            totalTTC={taxResult.total_ttc}
                            apAmount={taxResult.ap_amount}
                            costOfficial={taxResult.cost_official}
                        />
                    )}

                    {/* Calculation Steps */}
                    {taxResult?.tax_lines && taxResult.tax_lines.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-accent)' }}>
                                <Calculator size={12} className="inline mr-1" />
                                Calculation Steps
                            </h3>
                            <div className="space-y-1.5">
                                {taxResult.tax_lines.map((line, idx) => {
                                    const base = typeof line.base_amount === 'string' ? parseFloat(line.base_amount) : (line.base_amount || 0)
                                    const rate = typeof line.rate === 'string' ? parseFloat(line.rate) : line.rate
                                    const amount = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
                                    return (
                                        <div key={idx} className="rounded-lg border border-white/5 bg-app-surface/20 p-2.5 text-[11px]">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>Step {idx + 1}:</span>
                                                <span className="font-semibold" style={{ color: 'var(--app-accent)' }}>{line.type}{line.name ? ` (${line.name})` : ''}</span>
                                            </div>
                                            <div style={{ color: 'var(--app-muted)' }}>
                                                {fmt(base)} × {(rate * 100).toFixed(2)}% = <span className="font-mono font-bold" style={{ color: 'var(--app-foreground)' }}>{fmt(amount)}</span>
                                                {line.behavior && <span className="ml-2 text-[9px] font-bold uppercase" style={{ color: 'var(--app-muted)' }}>→ {line.behavior?.replace(/_/g, ' ')}</span>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
