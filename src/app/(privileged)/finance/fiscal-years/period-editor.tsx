'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updatePeriod } from '@/app/actions/finance/fiscal-year'
import { useModalDismiss } from '@/hooks/useModalDismiss'

export default function PeriodEditor({ period, onClose }: { period: Record<string, any>; onClose: () => void }) {
    const [isPending, setIsPending] = useState(false)
    const { backdropProps, contentProps } = useModalDismiss(true, onClose)
    const [formData, setFormData] = useState({
        name: period.name,
        startDate: (period.start_date || period.startDate || '').split('T')[0],
        endDate: (period.end_date || period.endDate || '').split('T')[0],
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsPending(true)
        try {
            await updatePeriod(period.id, { name: formData.name, start_date: formData.startDate, end_date: formData.endDate })
            toast.success('Period updated')
            onClose()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : String(err))
        } finally {
            setIsPending(false)
        }
    }

    return (
        <div {...backdropProps} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div {...contentProps} className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="px-4 py-3 flex justify-between items-center" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <h3 className="text-tp-md" style={{ color: 'var(--app-foreground)' }}>Edit Period</h3>
                    <button onClick={onClose} className="p-1 rounded-lg transition-all" style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={14} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-3">
                    <div>
                        <label className="text-tp-xxs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Period Name</label>
                        <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-tp-md font-medium text-app-foreground outline-none focus:border-app-primary" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label className="text-tp-xxs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Start</label>
                            <input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-tp-sm font-medium text-app-foreground outline-none" />
                        </div>
                        <div>
                            <label className="text-tp-xxs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--app-muted-foreground)' }}>End</label>
                            <input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-tp-sm font-medium text-app-foreground outline-none" />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2 text-tp-sm font-bold rounded-xl border transition-all"
                            style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending}
                            className="flex-1 py-2 text-tp-sm font-bold rounded-xl transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            {isPending ? <><Loader2 size={12} className="animate-spin inline mr-1" /> Saving...</> : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
