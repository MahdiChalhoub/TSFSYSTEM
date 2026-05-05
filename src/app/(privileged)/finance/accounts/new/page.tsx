'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import {
    Landmark, ArrowLeft, Loader2, Link as LinkIcon,
    DollarSign, Plus, Monitor, BookOpen, FolderTree, Zap, Info
} from "lucide-react"
import { getAccountCategories, getOrgCurrency, getOrgPaymentGateways } from "../actions"
import { erpFetch } from "@/lib/erp-api"
import { getIcon } from "../../account-categories/_components/constants"
import type { ProviderFieldDef } from "../../account-categories/_components/constants"

/* ── Reusable toggle tile ── */
function ToggleTile({ on, onToggle, icon: Icon, color, title, descOn, descOff, inherited }: {
    on: boolean; onToggle: () => void; icon: any; color: string
    title: string; descOn: string; descOff: string; inherited?: boolean
}) {
    const c = on ? color : 'var(--app-muted-foreground)'
    return (
        <button type="button" onClick={onToggle}
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
            style={{
                background: on ? `color-mix(in srgb, ${color} 10%, var(--app-surface))` : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                border: `1px solid color-mix(in srgb, ${on ? color : 'var(--app-border)'} ${on ? '40' : '50'}%, transparent)`,
            }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}>
                <Icon size={16} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[12px] font-black text-app-foreground flex items-center gap-1.5">
                    {title}
                    {inherited && (
                        <span className="font-bold px-1 py-px rounded"
                            style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                            INHERITED
                        </span>
                    )}
                </div>
                <div className="text-[9px] font-bold text-app-muted-foreground">{on ? descOn : descOff}</div>
            </div>
            <div className={`ml-auto w-9 h-5 rounded-full flex items-center transition-all shrink-0 ${on ? 'justify-end' : 'justify-start'}`}
                style={{ background: on ? color : 'color-mix(in srgb, var(--app-border) 80%, transparent)' }}>
                <div className="w-4 h-4 rounded-full shadow mx-0.5" style={{ background: 'var(--app-bg, #fff)' }} />
            </div>
        </button>
    )
}

/* ── Inline form input classes ── */
const inputCls = "w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary focus:ring-2 focus:ring-app-primary/10 transition-all"
const labelCls = "text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block"

export default function NewFinancialAccountPage() {
    const router = useRouter()
    const [categories, setCategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [currency, setCurrency] = useState('...')
    const [orgGateways, setOrgGateways] = useState<any[]>([])

    /* ── Form State ── */
    const [name, setName] = useState('')
    const [categoryId, setCategoryId] = useState<string>('')
    const [description, setDescription] = useState('')
    const [isPosEnabled, setIsPosEnabled] = useState(false)
    const [hasAccountBook, setHasAccountBook] = useState(false)
    /* Digital integration */
    const [digitalGatewayId, setDigitalGatewayId] = useState('')
    const [digitalConfig, setDigitalConfig] = useState<Record<string, string>>({})
    /* Track if the user has manually overridden defaults */
    const [posOverridden, setPosOverridden] = useState(false)
    const [bookOverridden, setBookOverridden] = useState(false)

    useEffect(() => {
        Promise.all([getAccountCategories(), getOrgCurrency(), getOrgPaymentGateways()])
            .then(([cats, curr, gw]) => {
                setCategories(Array.isArray(cats) ? cats.filter((c: any) => c.is_active) : [])
                setCurrency(curr)
                setOrgGateways(Array.isArray(gw) ? gw : [])
            })
            .catch(() => toast.error('Failed to load data'))
            .finally(() => setLoading(false))
    }, [])

    /* ── Category change → inherit defaults ── */
    const handleCategoryChange = (newId: string) => {
        setCategoryId(newId)
        const cat = categories.find(c => String(c.id) === newId)
        if (cat) {
            if (!posOverridden) setIsPosEnabled(cat.default_pos_enabled || false)
            if (!bookOverridden) setHasAccountBook(cat.default_has_account_book || false)
            // Inherit digital gateway from category
            setDigitalGatewayId(cat.is_digital && cat.digital_gateway ? String(cat.digital_gateway) : '')
            setDigitalConfig({})
        }
    }

    const selectedCat = categories.find(c => String(c.id) === categoryId)
    const coaCode = selectedCat?.coa_parent_code
    const coaName = selectedCat?.coa_parent_name
    const previewCode = coaCode ? `${coaCode}.XXX` : '—'
    const isDigital = selectedCat?.is_digital || false

    // Find the selected OrgPaymentGateway from API data
    const selectedGw = orgGateways.find((g: any) => String(g.id) === digitalGatewayId)
    const configSchema: ProviderFieldDef[] = selectedGw?.config_schema || []

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) { toast.error('Account name is required'); return }
        if (!selectedCat) { toast.error('Select an account category'); return }
        if (!selectedCat.coa_parent) { toast.error('Category has no COA parent — configure it in Account Categories'); return }
        setSubmitting(true)
        try {
            await erpFetch('accounts/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(), type: selectedCat.code, currency, description,
                    is_pos_enabled: isPosEnabled, has_account_book: hasAccountBook,
                    ledger_account: selectedCat.coa_parent,
                    category: selectedCat.id,
                    digital_gateway: isDigital && digitalGatewayId ? parseInt(digitalGatewayId) : null,
                    digital_config: isDigital ? digitalConfig : {},
                }),
            })
            toast.success('Account created successfully')
            router.push('/finance/accounts')
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
        } finally { setSubmitting(false) }
    }

    const CatIcon = selectedCat ? getIcon(selectedCat.icon) : FolderTree
    const infoTiles = [
        { label: 'Category', value: selectedCat?.name ?? 'Select one', color: selectedCat?.color || 'var(--app-primary)', icon: <CatIcon size={14} /> },
        { label: 'Currency', value: currency, color: 'var(--app-info, #3b82f6)', icon: <DollarSign size={14} /> },
        { label: 'Account Code', value: previewCode, color: 'var(--app-accent)', icon: <LinkIcon size={14} /> },
    ]

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-app-primary" />
        </div>
    )

    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all">
            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Link href="/finance/accounts">
                        <button className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <ArrowLeft size={13} /><span className="hidden sm:inline">Back</span>
                        </button>
                    </Link>
                    <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Landmark size={20} className="text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">Finance · Accounts</p>
                        <h1>New Financial Account</h1>
                    </div>
                </div>
            </div>

            {/* ── Context Info Strip ── */}
            <div className="mb-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                {infoTiles.map(s => (
                    <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                            <div className="text-sm font-black text-app-foreground tabular-nums truncate">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Form ── */}
            <form onSubmit={onSubmit} className="flex-1 min-h-0 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
                {/* Row 1: Name + Category */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'start' }}>
                    <div>
                        <label className={labelCls}>Account Name <span style={{ color: 'var(--app-error, #ef4444)' }}>*</span></label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Front Desk Cash, Main Bank" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Category <span style={{ color: 'var(--app-error, #ef4444)' }}>*</span></label>
                        <select value={categoryId} onChange={e => handleCategoryChange(e.target.value)}
                            className={`${inputCls} appearance-none`}
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                            <option value="">Select a category…</option>
                            {categories.map(c => (
                                <option key={c.id} value={String(c.id)}>
                                    {c.name} {c.coa_parent_code ? `(${c.coa_parent_code})` : ''} {c.is_digital ? '⚡' : ''}
                                </option>
                            ))}
                        </select>
                        {categories.length === 0 && (
                            <Link href="/finance/account-categories" className="text-[10px] font-bold mt-1 block" style={{ color: 'var(--app-primary)' }}>
                                No categories found — create one first →
                            </Link>
                        )}
                    </div>
                </div>

                {/* Row 2: Currency + Description */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'start' }}>
                    <div>
                        <label className={labelCls}>Currency</label>
                        <input value={currency} readOnly className={`${inputCls} cursor-default`}
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)' }} />
                        <span className="text-[9px] font-bold text-app-muted-foreground mt-1 block">From organization base currency</span>
                    </div>
                    <div>
                        <label className={labelCls}>Description <span className="font-bold">(optional)</span></label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="Notes about this account..." rows={2} className={`${inputCls} resize-none`} />
                    </div>
                </div>

                {/* Row 3: Toggles (inherited from category) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <ToggleTile on={isPosEnabled} onToggle={() => { setIsPosEnabled(!isPosEnabled); setPosOverridden(true) }} icon={Monitor}
                        color="var(--app-success, #22c55e)" title="POS Enabled"
                        descOn="Available in POS terminals" descOff="Not visible in POS screen"
                        inherited={!posOverridden && selectedCat?.default_pos_enabled} />
                    <ToggleTile on={hasAccountBook} onToggle={() => { setHasAccountBook(!hasAccountBook); setBookOverridden(true) }} icon={BookOpen}
                        color="var(--app-info, #3b82f6)" title="Account Book"
                        descOn="Dedicated ledger book enabled" descOff="No separate account book"
                        inherited={!bookOverridden && selectedCat?.default_has_account_book} />
                </div>

                {/* ── Digital Integration Section (API-driven providers) ── */}
                {isDigital && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded flex items-center justify-center"
                                style={{ background: 'color-mix(in srgb, var(--app-accent) 12%, transparent)', color: 'var(--app-accent)' }}>
                                <Zap size={11} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Digital Integration</span>
                        </div>

                        {/* Provider selector — from API */}
                        <div>
                            <label className={labelCls}>Payment Provider</label>
                            {orgGateways.length === 0 ? (
                                <div className="rounded-xl px-3 py-3 text-[10px] font-bold text-center"
                                    style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)', color: 'var(--app-warning, #f59e0b)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)' }}>
                                    No payment gateways activated. Go to Settings → Payment Gateways.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {orgGateways.filter((g: any) => g.is_enabled).map((gw: any) => (
                                        <button key={gw.id} type="button"
                                            onClick={() => { setDigitalGatewayId(String(gw.id)); setDigitalConfig({}) }}
                                            className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all"
                                            style={{
                                                background: digitalGatewayId === String(gw.id)
                                                    ? `color-mix(in srgb, ${gw.gateway_color || 'var(--app-accent)'} 10%, var(--app-surface))`
                                                    : 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                                                border: `1.5px solid ${digitalGatewayId === String(gw.id) ? (gw.gateway_color || 'var(--app-accent)') : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                                            }}>
                                            <span className="text-sm">{gw.gateway_emoji || '💳'}</span>
                                            <div className="min-w-0">
                                                <div className="text-[10px] font-black text-app-foreground truncate">{gw.gateway_name}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Provider-specific config fields — schema from API */}
                        {selectedGw && configSchema.length > 0 && (
                            <div className="rounded-xl p-3 space-y-2.5 animate-in fade-in duration-200"
                                style={{ background: `color-mix(in srgb, ${selectedGw.gateway_color || 'var(--app-accent)'} 4%, var(--app-surface))`, border: `1px solid color-mix(in srgb, ${selectedGw.gateway_color || 'var(--app-accent)'} 15%, transparent)` }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-base">{selectedGw.gateway_emoji || '💳'}</span>
                                    <div>
                                        <div className="text-[11px] font-black text-app-foreground">{selectedGw.gateway_name} Configuration</div>
                                        <div className="text-[8px] font-bold text-app-muted-foreground">{selectedGw.gateway_description}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                                    {configSchema.map((field: ProviderFieldDef) => (
                                        <div key={field.key}>
                                            <label className={labelCls}>
                                                {field.label} {field.required && <span style={{ color: 'var(--app-error, #ef4444)' }}>*</span>}
                                            </label>
                                            {field.type === 'select' ? (
                                                <select
                                                    value={digitalConfig[field.key] || ''}
                                                    onChange={e => setDigitalConfig(c => ({ ...c, [field.key]: e.target.value }))}
                                                    className={`${inputCls} appearance-none`}
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                                                    <option value="">Select...</option>
                                                    {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                            ) : (
                                                <input
                                                    type={field.type}
                                                    value={digitalConfig[field.key] || ''}
                                                    onChange={e => setDigitalConfig(c => ({ ...c, [field.key]: e.target.value }))}
                                                    placeholder={field.placeholder}
                                                    className={inputCls}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-start gap-1.5 mt-1 text-[8px] font-bold text-app-muted-foreground">
                                    <Info size={10} className="shrink-0 mt-0.5" />
                                    <span>Credentials are stored securely per-account and never shared across categories.</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── COA Linkage Info ── */}
                {selectedCat && coaCode && (
                    <div className="flex gap-3 items-start px-4 py-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200"
                        style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)', borderLeft: `3px solid ${selectedCat.color || 'var(--app-info)'}` }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                            <FolderTree size={15} />
                        </div>
                        <div>
                            <h4 className="font-black text-app-foreground leading-none mb-1">Auto-Linked to COA</h4>
                            <p className="text-[11px] font-bold text-app-muted-foreground leading-relaxed">
                                Child account under <span className="font-black text-app-foreground">{coaCode} — {coaName}</span> · Code: <span className="font-mono font-black" style={{ color: selectedCat.color || 'var(--app-primary)' }}>{previewCode}</span>
                            </p>
                        </div>
                    </div>
                )}
                {selectedCat && !selectedCat.coa_parent && (
                    <div className="px-4 py-3 rounded-xl text-[11px] font-bold" style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)', borderLeft: '3px solid var(--app-warning, #f59e0b)', color: 'var(--app-warning, #f59e0b)' }}>
                        ⚠ This category has no COA parent. <Link href="/finance/account-categories" className="underline font-black">Configure it →</Link>
                    </div>
                )}

                {/* ── Submit ── */}
                <button type="submit" disabled={submitting || !name.trim() || !selectedCat}
                    className="flex items-center justify-center gap-2 w-full text-[12px] font-black bg-app-primary hover:brightness-110 text-white px-4 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                    {submitting ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : <><Plus size={14} /> Create Account</>}
                </button>
            </form>
        </div>
    )
}