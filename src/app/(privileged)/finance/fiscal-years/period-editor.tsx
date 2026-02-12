'use client'

import { useState } from 'react'
import { updatePeriod } from '@/app/actions/finance/fiscal-year'

interface Props {
    period: any
    onClose: () => void
}

export default function PeriodEditor({ period, onClose }: Props) {
    const [isPending, setIsPending] = useState(false)
    const [formData, setFormData] = useState({
        name: period.name,
        startDate: typeof period.startDate === 'string' ? period.startDate.split('T')[0] : period.startDate?.toISOString?.()?.split('T')[0] || '',
        endDate: typeof period.endDate === 'string' ? period.endDate.split('T')[0] : period.endDate?.toISOString?.()?.split('T')[0] || ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsPending(true)
        try {
            await updatePeriod(period.id, {
                name: formData.name,
                startDate: new Date(formData.startDate),
                endDate: new Date(formData.endDate)
            })
            onClose()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setIsPending(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                    <h3 className="font-bold text-stone-900">Edit Period</h3>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-600">├ù</button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Period Name</label>
                        <input
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full border border-stone-300 rounded-md p-2"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Start</label>
                            <input
                                type="date"
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                className="w-full border border-stone-300 rounded-md p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-stone-500 mb-1">End</label>
                            <input
                                type="date"
                                value={formData.endDate}
                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                className="w-full border border-stone-300 rounded-md p-2 text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2 text-stone-600 font-medium text-sm hover:bg-stone-50 rounded">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 py-2 bg-black text-white font-medium text-sm rounded hover:bg-stone-800 disabled:opacity-50"
                        >
                            {isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}