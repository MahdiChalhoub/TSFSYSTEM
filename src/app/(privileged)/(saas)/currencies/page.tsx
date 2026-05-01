'use client'

import { useState, useEffect, useTransition } from 'react'
import { getCurrencies, createCurrency, updateCurrency, deleteCurrency, type Currency } from '@/app/actions/currencies'
import { Coins, Plus, Pencil, Trash2, X, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export default function CurrenciesPage() {
    const [currencies, setCurrencies] = useState<Currency[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    // Form state
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [formData, setFormData] = useState({ name: '', code: '', symbol: '' })
    const [error, setError] = useState('')
    const [pendingDelete, setPendingDelete] = useState<{ id: number; code: string } | null>(null)

    const loadCurrencies = async () => {
        setLoading(true)
        const data = await getCurrencies()
        setCurrencies(data)
        setLoading(false)
    }

    useEffect(() => { loadCurrencies() }, [])

    const resetForm = () => {
        setShowForm(false)
        setEditingId(null)
        setFormData({ name: '', code: '', symbol: '' })
        setError('')
    }

    const handleEdit = (c: Currency) => {
        setEditingId(c.id)
        setFormData({ name: c.name, code: c.code, symbol: c.symbol })
        setShowForm(true)
        setError('')
    }

    const handleSubmit = () => {
        if (!formData.name || !formData.code || !formData.symbol) {
            setError('All fields are required')
            return
        }
        startTransition(async () => {
            const res = editingId
                ? await updateCurrency(editingId, formData)
                : await createCurrency(formData)

            if (res.success) {
                resetForm()
                await loadCurrencies()
            } else {
                setError(res.error || 'Operation failed')
            }
        })
    }

    const handleDelete = (id: number, code: string) => {
        startTransition(async () => {
            const res = await deleteCurrency(id)
            if (res.success) {
                await loadCurrencies()
            } else {
                toast.error(res.error || 'Failed to delete currency')
            }
        })
    }

    return (
        <div className="p-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-app-gradient-warning rounded-xl text-white shadow-lg">
                        <Coins size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-app-foreground font-serif">Currency Management</h1>
                        <p className="text-sm text-app-muted-foreground">Manage available currencies across the platform</p>
                    </div>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true) }}
                    className="flex items-center gap-2 bg-app-foreground text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-app-surface transition-colors shadow-sm"
                >
                    <Plus size={16} />
                    Add Currency
                </button>
            </div>

            {/* Add/Edit Form */}
            {showForm && (
                <div className="mb-6 bg-app-surface border border-app-border rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-app-foreground">
                            {editingId ? 'Edit Currency' : 'Add New Currency'}
                        </h3>
                        <button onClick={resetForm} className="text-app-muted-foreground hover:text-app-muted-foreground">
                            <X size={16} />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-3 p-2.5 bg-app-error-bg border border-app-error rounded-lg text-xs text-app-error font-medium">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-app-muted-foreground mb-1">Currency Name</label>
                            <input
                                value={formData.name}
                                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. US Dollar"
                                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-black outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-app-muted-foreground mb-1">Code (ISO 4217)</label>
                            <input
                                value={formData.code}
                                onChange={e => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                placeholder="e.g. USD"
                                maxLength={10}
                                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm uppercase focus:ring-2 focus:ring-black focus:border-black outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-app-muted-foreground mb-1">Symbol</label>
                            <input
                                value={formData.symbol}
                                onChange={e => setFormData(p => ({ ...p, symbol: e.target.value }))}
                                placeholder="e.g. $"
                                maxLength={10}
                                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-black outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={resetForm}
                            className="px-4 py-2 text-sm font-medium text-app-muted-foreground bg-app-surface-2 rounded-lg hover:bg-app-surface-2 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-app-foreground rounded-lg hover:bg-app-surface transition-colors disabled:opacity-50"
                        >
                            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            {editingId ? 'Update' : 'Create'}
                        </button>
                    </div>
                </div>
            )}

            {/* Currency Table */}
            <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-app-surface border-b border-app-border">
                            <th className="text-left px-5 py-3 text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Code</th>
                            <th className="text-left px-5 py-3 text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Name</th>
                            <th className="text-left px-5 py-3 text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Symbol</th>
                            <th className="text-right px-5 py-3 text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="text-center py-12 text-app-muted-foreground">
                                    <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                                    Loading currencies...
                                </td>
                            </tr>
                        ) : currencies.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="text-center py-12 text-app-muted-foreground">
                                    <Coins size={24} className="mx-auto mb-2 opacity-40" />
                                    <p className="text-sm font-medium">No currencies configured</p>
                                    <p className="text-xs mt-1">Click &quot;Add Currency&quot; to get started</p>
                                </td>
                            </tr>
                        ) : currencies.map(c => (
                            <tr key={c.id} className="hover:bg-app-surface transition-colors">
                                <td className="px-5 py-3.5">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-app-warning-bg text-app-warning text-xs font-bold">
                                        {c.code}
                                    </span>
                                </td>
                                <td className="px-5 py-3.5 text-sm text-app-foreground font-medium">{c.name}</td>
                                <td className="px-5 py-3.5 text-sm text-app-muted-foreground font-semibold">{c.symbol}</td>
                                <td className="px-5 py-3.5 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <button
                                            onClick={() => handleEdit(c)}
                                            className="p-1.5 text-app-muted-foreground hover:text-app-info hover:bg-app-info-bg rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => setPendingDelete({ id: c.id, code: c.code })}
                                            className="p-1.5 text-app-muted-foreground hover:text-app-error hover:bg-app-error-bg rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Stats Footer */}
            {!loading && currencies.length > 0 && (
                <div className="mt-4 text-xs text-app-muted-foreground text-right">
                    {currencies.length} {currencies.length === 1 ? 'currency' : 'currencies'} configured
                </div>
            )}

            <ConfirmDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
                onConfirm={() => {
                    if (pendingDelete) handleDelete(pendingDelete.id, pendingDelete.code)
                    setPendingDelete(null)
                }}
                title="Delete Currency"
                description={`Delete currency ${pendingDelete?.code || ''}? This cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />
        </div>
    )
}
