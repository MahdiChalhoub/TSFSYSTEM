'use client'

import { useState, useEffect, useMemo } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { Percent, Plus, Star, Trash2, RefreshCw, CheckCircle, XCircle, Edit2, Save, X, Info, TrendingUp, LayoutGrid } from 'lucide-react'
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

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
    const settings = useListViewSettings('fin_tax_groups', {
        columns: ['name', 'rate', 'description', 'actions'],
        pageSize: 25, sortKey: 'name', sortDir: 'asc'
    })

    useEffect(() => { load() }, [])

    async function load() {
        setLoading(true)
        try {
            const data = await erpFetch('finance/tax-groups/')
            setGroups(Array.isArray(data) ? data : (data?.results ?? []))
        } catch {
            setGroups([])
            toast.error("Failed to load tax groups")
        } finally {
            setLoading(false)
        }
    }

    function startEdit(tg: TaxGroup) {
        setEditing(tg)
        setForm({ name: tg.name, rate: String(tg.rate), description: tg.description || '', tax_type: tg.tax_type || 'STANDARD' })
        setShowForm(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    function startCreate() {
        setEditing(null)
        setForm(EMPTY_FORM)
        setShowForm(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
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
                toast.success('Tax group updated')
            } else {
                await erpFetch('finance/tax-groups/', { method: 'POST', body: JSON.stringify(body) })
                toast.success('Tax group created')
            }
            cancelForm()
            load()
        } catch {
            toast.error('Save failed')
        } finally {
            setSaving(false)
        }
    }

    async function handleSetDefault(id: number) {
        setSettingDefault(id)
        try {
            await erpFetch('finance/tax-groups/set_default/', { method: 'POST', body: JSON.stringify({ tax_group_id: id }) })
            toast.success('Default tax group updated')
            load()
        } catch {
            toast.error('Failed to set default')
        } finally {
            setSettingDefault(null)
        }
    }

    async function handleDelete(id: number) {
        setDeleting(id)
        try {
            await erpFetch(`finance/tax-groups/${id}/`, { method: 'DELETE' })
            toast.success('Tax group deleted')
            load()
        } catch {
            toast.error('Delete failed — may be in use')
        } finally {
            setDeleting(null)
        }
    }

    const stats = useMemo(() => {
        const total = groups.length
        const avg = total ? (groups.reduce((s, g) => s + Number(g.rate || 0), 0) / total) : 0
        const def = groups.find(g => g.is_default)?.name || 'None'
        return { total, avg, def }
    }, [groups])

    const columns: ColumnDef<TaxGroup>[] = useMemo(() => [
        {
            key: 'name',
            label: 'Tax Group Configuration',
            sortable: true,
            render: (tg) => (
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center bg-stone-50 border border-stone-100 shrink-0 shadow-inner">
                        <span className="text-sm font-black text-amber-600">{Number(tg.rate).toFixed(0)}</span>
                        <span className="text-[10px] text-stone-400 font-bold">%</span>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-sm">{tg.name}</span>
                            {tg.is_default && (
                                <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[9px] font-black uppercase px-2 h-4 rounded-lg flex items-center gap-1">
                                    <Star size={8} fill="currentColor" /> Default
                                </Badge>
                            )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{tg.tax_type?.replace('_', ' ') || 'STANDARD'}</span>
                    </div>
                </div>
            )
        },
        {
            key: 'rate',
            label: 'Rate (%)',
            align: 'right',
            sortable: true,
            render: (tg) => <span className="font-mono text-sm font-black text-amber-600">{Number(tg.rate).toFixed(2)}%</span>
        },
        {
            key: 'description',
            label: 'Applicability',
            render: (tg) => <span className="text-xs text-stone-400 font-medium truncate max-w-[200px] inline-block">{tg.description || 'No description'}</span>
        },
        {
            key: 'actions',
            label: '',
            align: 'right',
            render: (tg) => (
                <div className="flex items-center justify-end gap-1">
                    {!tg.is_default && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSetDefault(tg.id)}
                            disabled={settingDefault === tg.id}
                            className="rounded-xl h-8 px-3 text-[10px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-all"
                        >
                            {settingDefault === tg.id ? '...' : 'Set Default'}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(tg)}
                        className="rounded-xl h-8 w-8 p-0 text-stone-400 hover:text-indigo-600"
                    >
                        <Edit2 size={14} />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(tg.id)}
                        disabled={deleting === tg.id || tg.is_default}
                        className="rounded-xl h-8 w-8 p-0 text-stone-300 hover:text-red-600 disabled:opacity-30"
                    >
                        {deleting === tg.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </Button>
                </div>
            )
        }
    ], [settingDefault, deleting])

    if (loading && groups.length === 0) {
        return (
            <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div><Skeleton className="h-10 w-64" /><Skeleton className="h-4 w-48 mt-2" /></div>
                    <Skeleton className="h-10 w-44" />
                </div>
                <div className="grid grid-cols-3 gap-6">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
                <Skeleton className="h-96 rounded-3xl" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 min-h-screen pb-24">
            {/* Standard Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-amber-600 flex items-center justify-center shadow-lg shadow-amber-200">
                            <Percent size={28} className="text-white" />
                        </div>
                        Tax <span className="text-amber-600">Groups</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">VAT & Tax Configuration</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={load} variant="ghost" className="h-12 w-12 rounded-2xl p-0 text-stone-400 hover:text-gray-900">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </Button>
                    <Button onClick={startCreate} className="h-12 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-amber-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        <Plus size={18} /> New Tax Group
                    </Button>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <LayoutGrid size={32} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Configured Groups</p>
                            <p className="text-3xl font-black mt-1 tracking-tighter text-stone-900">{stats.total}</p>
                            <p className="text-[10px] text-amber-600 font-bold uppercase mt-1">Active Rules</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <TrendingUp size={32} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Average Rate</p>
                            <p className="text-3xl font-black mt-1 tracking-tighter text-stone-900">{stats.avg.toFixed(1)}%</p>
                            <p className="text-[10px] text-indigo-600 font-bold uppercase mt-1">Weighted Mean</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Star size={32} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Default Group</p>
                            <p className="text-xl font-black mt-1 tracking-tight text-emerald-600 truncate">{stats.def}</p>
                            <p className="text-[10px] text-stone-400 font-bold uppercase mt-1">Primary Tax</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <div className="animate-in slide-in-from-top-4 duration-500">
                    <Card className="rounded-3xl border-0 shadow-xl bg-white border border-stone-100 overflow-hidden">
                        <div className="p-8 border-b border-stone-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black tracking-tight text-gray-900 flex items-center gap-2">
                                    <Edit2 size={20} className="text-amber-600" />
                                    {editing ? 'Edit Tax Protocol' : 'Register New Tax Group'}
                                </h3>
                                <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mt-1">Configuration Parameters</p>
                            </div>
                            <Button variant="ghost" onClick={cancelForm} className="h-10 w-10 rounded-xl p-0 text-stone-300 hover:text-gray-900">
                                <X size={20} />
                            </Button>
                        </div>
                        <div className="p-8 grid grid-cols-1 md:grid-cols-4 gap-6 bg-stone-50/30">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Group Name</label>
                                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VAT 20%" className="rounded-xl bg-white border-stone-200" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Rate (%)</label>
                                <Input type="number" step="0.01" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="20.0" className="rounded-xl bg-white border-stone-200" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Tax Type</label>
                                <select value={form.tax_type} onChange={e => setForm(f => ({ ...f, tax_type: e.target.value }))} className="w-full h-10 px-3 border border-stone-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-all">
                                    {TAX_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Description</label>
                                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details..." className="rounded-xl bg-white border-stone-200" />
                            </div>
                        </div>
                        <div className="p-8 border-t border-stone-50 flex justify-end gap-3 bg-white">
                            <Button variant="ghost" onClick={cancelForm} className="rounded-xl font-black text-[10px] uppercase tracking-widest">Cancel</Button>
                            <Button onClick={handleSave} disabled={saving || !form.name || !form.rate} className="rounded-xl bg-stone-900 hover:bg-black text-white font-black text-[10px] uppercase tracking-widest h-12 px-8 shadow-lg shadow-stone-200">
                                {saving ? <RefreshCw size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
                                {editing ? 'Update Policy' : 'Apply Configuration'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            <TypicalListView
                title="Taxation Authority Matrix"
                data={groups}
                loading={loading}
                getRowId={(tg) => tg.id}
                columns={columns}
                className="rounded-3xl border-0 shadow-sm overflow-hidden"
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
            />
        </div>
    )
}
