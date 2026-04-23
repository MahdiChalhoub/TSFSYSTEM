'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
    Plus, Trash2, Edit3, Settings2, Loader2,
    ArrowLeft, GripVertical, FolderTree
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    getAccountCategories, createAccountCategory, updateAccountCategory,
    deleteAccountCategory, getChartOfAccounts
} from '../accounts/actions'
import { getIcon, DEFAULT_COLOR } from './_components/constants'
import { CategoryFormModal, type CategoryFormData } from './_components/CategoryFormModal'

const INITIAL_FORM: CategoryFormData = {
    name: '', code: '', icon: 'wallet', color: '#6366f1',
    description: '', coa_parent: '', sort_order: 0
}

export default function AccountCategoriesPage() {
    const [categories, setCategories] = useState<any[]>([])
    const [coaList, setCoaList] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
    const [form, setForm] = useState<CategoryFormData>(INITIAL_FORM)

    const load = async () => {
        try {
            const [cats, coa] = await Promise.all([
                getAccountCategories(),
                getChartOfAccounts(),
            ])
            setCategories(Array.isArray(cats) ? cats : [])
            setCoaList(Array.isArray(coa) ? coa : [])
        } catch (e: any) { toast.error(e?.message || 'Failed to load data') }
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    const resetForm = () => {
        setForm(INITIAL_FORM)
        setShowForm(false)
        setEditingId(null)
    }

    const startEdit = (cat: any) => {
        setForm({
            name: cat.name, code: cat.code, icon: cat.icon || 'wallet',
            color: cat.color || '#6366f1', description: cat.description || '',
            coa_parent: cat.coa_parent?.toString() || '', sort_order: cat.sort_order || 0
        })
        setEditingId(cat.id)
        setShowForm(true)
    }

    const handleSave = async () => {
        if (!form.name || !form.code) { toast.error('Name and code are required'); return }
        setSaving(true)
        try {
            const payload: any = {
                name: form.name, code: form.code.toUpperCase(),
                icon: form.icon, color: form.color,
                description: form.description, sort_order: form.sort_order,
            }
            if (form.coa_parent) payload.coa_parent = parseInt(form.coa_parent)
            else payload.coa_parent = null

            if (editingId) {
                await updateAccountCategory(editingId, payload)
                toast.success('Category updated')
            } else {
                await createAccountCategory(payload)
                toast.success('Category created')
            }
            resetForm()
            load()
        } catch (e: any) {
            toast.error(e?.message || 'Failed')
        }
        setSaving(false)
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            await deleteAccountCategory(deleteTarget)
            toast.success('Category deleted')
            load()
        } catch (e: any) {
            toast.error(e?.message || 'Cannot delete — has linked accounts')
        }
        setDeleteTarget(null)
    }

    const totalAccounts = categories.reduce((sum, c) => sum + (c.account_count || 0), 0)

    if (loading) return (
        <div className="app-page flex items-center justify-center py-32">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--app-primary)', opacity: 0.6 }} />
        </div>
    )

    return (
        <div className="app-page max-w-4xl mx-auto space-y-5 animate-in fade-in duration-300">
            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <Link href="/finance/accounts">
                        <button className="w-9 h-9 rounded-xl border border-app-border flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-app-surface transition-all">
                            <ArrowLeft size={16} />
                        </button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Settings2 size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black text-app-text tracking-tight">
                                Account <span style={{ color: 'var(--app-primary)' }}>Categories</span>
                            </h1>
                            <p className="text-[10px] font-bold text-app-text-faint uppercase tracking-widest">
                                {categories.length} categories · {totalAccounts} accounts linked
                            </p>
                        </div>
                    </div>
                </div>

                <Button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-xl gap-2">
                    <Plus size={14} /> New Category
                </Button>
            </div>

            {/* ── KPI Ribbon ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Categories', value: categories.length, color: 'var(--app-primary)' },
                    { label: 'Active', value: categories.filter(c => c.is_active).length, color: 'var(--app-success)' },
                    { label: 'With COA Link', value: categories.filter(c => c.coa_parent).length, color: 'var(--app-info)' },
                    { label: 'Total Accounts', value: totalAccounts, color: 'var(--app-warning)' },
                ].map(kpi => (
                    <div key={kpi.label} className="rounded-xl border border-app-border/50 px-4 py-3"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-app-text-faint">{kpi.label}</p>
                        <p className="text-xl font-black mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* ── Form Modal ── */}
            {showForm && (
                <CategoryFormModal
                    form={form} setForm={setForm} coaList={coaList}
                    editingId={editingId} saving={saving}
                    onSave={handleSave} onClose={resetForm}
                />
            )}

            {/* ── Category Cards ── */}
            <div className="space-y-2">
                {categories.length === 0 ? (
                    <div className="text-center py-16 rounded-2xl border-2 border-dashed border-app-border">
                        <FolderTree size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-bold text-app-text-muted">No categories yet</p>
                        <p className="text-[11px] text-app-text-faint mt-1">Create your first category to organize financial accounts.</p>
                    </div>
                ) : (
                    categories.map(cat => {
                        const Icon = getIcon(cat.icon)
                        const color = cat.color || DEFAULT_COLOR
                        const coaInfo = cat.coa_parent_name ? `${cat.coa_parent_code} — ${cat.coa_parent_name}` : null
                        return (
                            <div key={cat.id}
                                className="flex items-center gap-4 p-4 rounded-xl border border-app-border/60 bg-app-surface hover:border-app-border transition-all group"
                                style={{ borderLeft: `4px solid ${color}` }}>
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                                    <Icon size={22} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black text-app-text truncate">{cat.name}</h3>
                                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded text-app-text-faint"
                                            style={{ background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                            {cat.code}
                                        </span>
                                        {!cat.is_active && (
                                            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-rose-500/10 text-rose-500">INACTIVE</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-app-text-faint">
                                        <span className="font-bold">{cat.account_count || 0} accounts</span>
                                        {coaInfo && (
                                            <span className="flex items-center gap-1">
                                                <FolderTree size={9} /> {coaInfo}
                                            </span>
                                        )}
                                        {cat.description && (
                                            <span className="hidden sm:inline truncate max-w-[200px]">· {cat.description}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-app-text-faint shrink-0">
                                    <GripVertical size={12} className="opacity-40" />
                                    #{cat.sort_order}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => startEdit(cat)}>
                                        <Edit3 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600" onClick={() => setDeleteTarget(cat.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            <ConfirmDialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                onConfirm={handleDelete} title="Delete Category?"
                description="Only empty categories (no linked accounts) can be deleted. Move accounts to another category first." variant="danger" />
        </div>
    )
}
