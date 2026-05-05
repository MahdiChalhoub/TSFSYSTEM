'use client'

import { Calendar, X, AlertTriangle, Loader2 } from 'lucide-react'
import { useModalDismiss } from '@/hooks/useModalDismiss'
import { useTranslation } from '@/hooks/use-translation'

export interface WizardFormData {
    name: string
    startDate: string
    endDate: string
    frequency: 'MONTHLY' | 'QUARTERLY'
    defaultPeriodStatus: 'OPEN' | 'FUTURE'
    includeAuditPeriod: boolean
}

interface WizardModalProps {
    data: WizardFormData
    setData: (next: WizardFormData | ((prev: WizardFormData) => WizardFormData)) => void
    onClose: () => void
    onSubmit: (e: React.FormEvent) => void
    isPending: boolean
}

export function WizardModal({ data, setData, onClose, onSubmit, isPending }: WizardModalProps) {
    const dismiss = useModalDismiss(true, onClose)
    const { t } = useTranslation()

    const sd = new Date(data.startDate)
    const ed = new Date(data.endDate)
    const validDates = !isNaN(sd.getTime()) && !isNaN(ed.getTime()) && ed >= sd
    const monthsSpan = validDates ? (ed.getFullYear() - sd.getFullYear()) * 12 + (ed.getMonth() - sd.getMonth()) + 1 : 0
    const isPartial = validDates && (sd.getMonth() !== 0 || sd.getDate() !== 1 || monthsSpan !== 12)
    const baseCount = data.frequency === 'MONTHLY' ? monthsSpan : Math.ceil(monthsSpan / 3)
    const totalCount = baseCount + (data.includeAuditPeriod ? 1 : 0)

    return (
        <div {...dismiss.backdropProps} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div {...dismiss.contentProps} className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="px-5 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                            <Calendar size={16} style={{ color: 'var(--app-primary)' }} />
                        </div>
                        <div>
                            <h2 className="text-tp-lg" style={{ color: 'var(--app-foreground)' }}>{t('finance.fiscal_years_page.wizard_title')}</h2>
                            <p className="text-tp-xs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>{t('finance.fiscal_years_page.wizard_subtitle')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--app-muted-foreground)' }}><X size={16} /></button>
                </div>
                <form onSubmit={onSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="text-tp-xxs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Year Name</label>
                        <input value={data.name} onChange={e => setData({ ...data, name: e.target.value })}
                            className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-tp-md font-medium text-app-foreground outline-none focus:border-app-primary" required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label className="text-tp-xxs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Start Date</label>
                            <input type="date" value={data.startDate} onChange={e => {
                                const s = new Date(e.target.value); const en = new Date(s); en.setFullYear(en.getFullYear() + 1); en.setDate(en.getDate() - 1)
                                setData({ ...data, startDate: e.target.value, endDate: en.toISOString().split('T')[0] })
                            }} className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-tp-md font-medium text-app-foreground outline-none" required />
                        </div>
                        <div>
                            <label className="text-tp-xxs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--app-muted-foreground)' }}>End Date</label>
                            <input type="date" value={data.endDate} onChange={e => setData({ ...data, endDate: e.target.value })}
                                className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-tp-md font-medium text-app-foreground outline-none" required />
                        </div>
                    </div>
                    {isPartial && (
                        <div className="rounded-xl p-3 flex items-start gap-2"
                            style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }}>
                            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-warning, #f59e0b)' }} />
                            <div>
                                <div className="text-tp-sm font-bold uppercase tracking-wider" style={{ color: 'var(--app-warning, #f59e0b)' }}>Partial Fiscal Year</div>
                                <div className="text-tp-xs font-medium mt-0.5" style={{ color: 'var(--app-foreground)' }}>
                                    Spans {monthsSpan} month{monthsSpan === 1 ? '' : 's'} ({sd.toLocaleDateString('en', { month: 'short', day: 'numeric' })} → {ed.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}). A standard fiscal year is 12 calendar months starting Jan 1.
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="rounded-xl p-4" style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 15%, transparent)' }}>
                        <div className="text-tp-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--app-info, #3b82f6)' }}>Period Strategy</div>
                        <div className="flex gap-3 mb-3">
                            {(['MONTHLY', 'QUARTERLY'] as const).map(f => {
                                const c = f === 'MONTHLY' ? monthsSpan : Math.ceil(monthsSpan / 3)
                                return (
                                    <label key={f} className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="freq" checked={data.frequency === f} onChange={() => setData({ ...data, frequency: f })} className="accent-[var(--app-primary)]" />
                                        <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>{f === 'MONTHLY' ? `Monthly (${c || 12})` : `Quarterly (${c || 4})`}</span>
                                    </label>
                                )
                            })}
                        </div>
                        <div className="mb-3">
                            <label className="text-tp-xxs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Initial Status</label>
                            <select value={data.defaultPeriodStatus} onChange={e => setData({ ...data, defaultPeriodStatus: e.target.value as 'OPEN' | 'FUTURE' })}
                                className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2 text-tp-sm font-medium text-app-foreground outline-none">
                                <option value="OPEN">OPEN — Active immediately</option>
                                <option value="FUTURE">FUTURE — Locked until needed</option>
                            </select>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={data.includeAuditPeriod} onChange={e => setData({ ...data, includeAuditPeriod: e.target.checked })} className="accent-[var(--app-primary)] rounded" />
                            <span className="text-tp-xs font-bold" style={{ color: 'var(--app-foreground)' }}>Include Audit Period (+1 adjustment period)</span>
                        </label>
                        {validDates && (
                            <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)' }}>
                                <span className="text-tp-xs font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>Will generate</span>
                                <span className="text-tp-md font-bold" style={{ color: 'var(--app-info, #3b82f6)' }}>
                                    {totalCount} period{totalCount === 1 ? '' : 's'}
                                    {data.includeAuditPeriod && <span className="text-tp-xs font-bold ml-1" style={{ color: 'var(--app-muted-foreground)' }}>({baseCount} + 1 audit)</span>}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 py-2 text-tp-sm font-bold rounded-xl border transition-all" style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>Cancel</button>
                        <button type="submit" disabled={isPending} className="flex-1 py-2 text-tp-sm font-bold rounded-xl transition-all disabled:opacity-50" style={{ background: 'var(--app-primary)', color: 'white' }}>
                            {isPending ? <><Loader2 size={12} className="animate-spin inline mr-1" /> Generating...</> : 'Generate Periods'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
