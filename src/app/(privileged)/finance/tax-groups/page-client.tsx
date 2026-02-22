'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { Percent, Plus, Star, Trash2, RefreshCw, CheckCircle, XCircle, Edit2, Save, X } from 'lucide-react'

type TaxGroup = {
    id: number
    name: string
    rate: number
    description?: string
    is_default: boolean
    tax_type?: string
}

type FormState = { name: string; rate: string; description: string; tax_type: string }

const EMPTY_FORM: FormState = { name: '', rate: '', description: '', tax_type: 'STANDARD' }
const TAX_TYPES = ['STANDARD', 'REDUCED', 'ZERO', 'EXEMPT', 'REVERSE_CHARGE']

export default function TaxGroupsPage() {
    const [groups, setGroups] = useState<TaxGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<TaxGroup | null>(null)
    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [settingDefault, setSettingDefault] = useState<number | null>(null)
    const [deleting, setDeleting] = useState<number | null>(null)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

    useEffect(() => { load() }, [])

    async function load() {
        setLoading(true)
        try {
            const data = await erpFetch('finance/tax-groups/')
            setGroups(Array.isArray(data) ? data : (data?.results ?? []))
        } catch { setGroups([]) }
        setLoading(false)
    }

    function showToast(msg: string, type: 'ok' | 'err') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    function startEdit(tg: TaxGroup) {
        setEditing(tg)
        setForm({ name: tg.name, rate: String(tg.rate), description: tg.description || '', tax_type: tg.tax_type || 'STANDARD' })
        setShowForm(false)
    }

    function startCreate() {
        setEditing(null)
        setForm(EMPTY_FORM)
        setShowForm(true)
    }

    function cancelForm() {
        setShowForm(false)
        setEditing(null)
        setForm(EMPTY_FORM)
    }

    async function handleSave() {
        if (!form.name || !form.rate) return
        setSaving(true)
        try {
            const body = { name: form.name, rate: parseFloat(form.rate), description: form.description, tax_type: form.tax_type }
            if (editing) {
                await erpFetch(`finance/tax-groups/${editing.id}/`, { method: 'PATCH', body: JSON.stringify(body) })
                showToast('Tax group updated', 'ok')
            } else {
                await erpFetch('finance/tax-groups/', { method: 'POST', body: JSON.stringify(body) })
                showToast('Tax group created', 'ok')
            }
            cancelForm()
            load()
        } catch { showToast('Save failed', 'err') }
        setSaving(false)
    }

    async function handleSetDefault(id: number) {
        setSettingDefault(id)
        try {
            await erpFetch('finance/tax-groups/set_default/', { method: 'POST', body: JSON.stringify({ tax_group_id: id }) })
            showToast('Default tax group updated', 'ok')
            load()
        } catch { showToast('Failed to set default', 'err') }
        setSettingDefault(null)
    }

    async function handleDelete(id: number) {
        setDeleting(id)
        try {
            await erpFetch(`finance/tax-groups/${id}/`, { method: 'DELETE' })
            showToast('Tax group deleted', 'ok')
            load()
        } catch { showToast('Delete failed — may be in use', 'err') }
        setDeleting(null)
    }

    const defaultGroup = groups.find(g => g.is_default)

    return (
        <div className="min-h-screen bg-[#070D1B] text-gray-100 p-6 flex flex-col gap-6">
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${toast.type === 'ok' ? 'bg-emerald-900/80 border-emerald-700 text-emerald-300' : 'bg-red-900/80 border-red-700 text-red-300'}`}>
                    {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-900/40">
                        <Percent size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-[1.5rem] bg-amber-600 flex items-center justify-center shadow-lg shadow-amber-200">
                                <Percent size={28} className="text-white" />
                            </div>
                            Tax <span className="text-amber-600">Groups</span>
                        </h1>
                        <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">VAT & Tax Configuration</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm">
                        <RefreshCw size={14} />Refresh
                    </button>
                    <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold shadow-lg shadow-violet-900/30">
                        <Plus size={14} />New Tax Group
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Groups', value: groups.length, color: 'violet' },
                    { label: 'Default Group', value: defaultGroup?.name || 'None set', color: 'amber', isText: true },
                    { label: 'Avg Rate', value: groups.length ? `${(groups.reduce((s, g) => s + Number(g.rate || 0), 0) / groups.length).toFixed(1)}%` : '—', color: 'blue', isText: true },
                ].map(s => (
                    <div key={s.label} className="bg-[#0F1729] rounded-2xl border border-gray-800 p-5">
                        <div className="text-xs text-gray-400 mb-2">{s.label}</div>
                        <div className={`text-2xl font-bold text-${s.color}-400`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Create / Edit Form */}
            {(showForm || editing) && (
                <div className="bg-[#0F1729] rounded-2xl border border-violet-800/40 p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white text-sm">{editing ? 'Edit Tax Group' : 'New Tax Group'}</h3>
                        <button onClick={cancelForm} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs text-gray-400 font-medium">Name *</label>
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. VAT 20%, Standard Tax" className="bg-[#070D1B] border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-violet-600" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs text-gray-400 font-medium">Rate (%) *</label>
                            <input type="number" step="0.01" min="0" max="100" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="e.g. 20" className="bg-[#070D1B] border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-violet-600" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs text-gray-400 font-medium">Tax Type</label>
                            <select value={form.tax_type} onChange={e => setForm(f => ({ ...f, tax_type: e.target.value }))} className="bg-[#070D1B] border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-violet-600">
                                {TAX_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs text-gray-400 font-medium">Description</label>
                            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" className="bg-[#070D1B] border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-violet-600" />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={cancelForm} className="px-4 py-2 rounded-xl bg-gray-800 text-gray-400 text-sm hover:bg-gray-700">Cancel</button>
                        <button onClick={handleSave} disabled={saving || !form.name || !form.rate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50">
                            <Save size={13} />{saving ? 'Saving…' : (editing ? 'Update' : 'Create')}
                        </button>
                    </div>
                </div>
            )}

            {/* Tax Groups list */}
            <div className="flex flex-col gap-2">
                {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />) :
                    groups.length === 0 ? (
                        <div className="bg-[#0F1729] rounded-2xl border border-gray-800 flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                            <Percent size={48} className="opacity-20" />
                            <p className="text-sm">No tax groups yet. Create one to get started.</p>
                            <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-700 hover:bg-violet-600 text-white text-sm font-semibold mt-2">
                                <Plus size={13} />Add First Tax Group
                            </button>
                        </div>
                    ) : (
                        groups.map(tg => (
                            <div key={tg.id} className={`flex items-center gap-4 px-5 py-4 rounded-xl border transition-all ${tg.is_default ? 'bg-violet-900/10 border-violet-800/50' : 'bg-[#0F1729] border-gray-800 hover:border-gray-700'}`}>
                                {/* Rate badge */}
                                <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-800/40 shrink-0">
                                    <span className="text-lg font-black text-violet-400">{Number(tg.rate).toFixed(0)}</span>
                                    <span className="text-[10px] text-violet-500 font-bold">%</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-base text-white">{tg.name}</span>
                                        {tg.is_default && (
                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-900/40 text-amber-400 border-amber-700">
                                                <Star size={9} />DEFAULT
                                            </span>
                                        )}
                                        {tg.tax_type && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-violet-900/30 text-violet-400 border-violet-800">
                                                {tg.tax_type.replace('_', ' ')}
                                            </span>
                                        )}
                                    </div>
                                    {tg.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{tg.description}</p>}
                                    <p className="text-xs text-gray-600 mt-0.5 font-mono">Rate: {Number(tg.rate).toFixed(2)}%</p>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    {!tg.is_default && (
                                        <button
                                            onClick={() => handleSetDefault(tg.id)}
                                            disabled={settingDefault === tg.id}
                                            title="Set as default"
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-900/20 hover:bg-amber-900/40 text-amber-500 text-xs font-semibold disabled:opacity-50 transition-colors"
                                        >
                                            <Star size={11} />
                                            {settingDefault === tg.id ? '…' : 'Set Default'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => startEdit(tg)}
                                        title="Edit"
                                        className="p-2 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 transition-colors"
                                    >
                                        <Edit2 size={13} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(tg.id)}
                                        disabled={deleting === tg.id || tg.is_default}
                                        title={tg.is_default ? "Can't delete the default tax group" : "Delete"}
                                        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        {deleting === tg.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                    </button>
                                </div>
                            </div>
                        ))
                    )
                }
            </div>
        </div>
    )
}
