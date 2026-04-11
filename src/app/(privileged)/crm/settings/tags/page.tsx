'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    Tag, Plus, Save, Trash2, ChevronRight, ChevronDown,
    FolderTree, Type, Search, ArrowLeft, RefreshCw,
    Building2, User, Briefcase, Wrench, TrendingDown, TrendingUp, Users, BookUser, CheckCircle2
} from 'lucide-react'
import { getContactTags, createContactTag, updateContactTag, deleteContactTag } from '@/app/actions/crm/contacts'
import Link from 'next/link'
import { toast } from 'sonner'

const TYPE_OPTS = [
    { value: '', label: 'Global', icon: Users },
    { value: 'CUSTOMER', label: 'Customers', icon: User },
    { value: 'SUPPLIER', label: 'Suppliers', icon: Briefcase },
    { value: 'BOTH', label: 'Mixed', icon: RefreshCw },
    { value: 'LEAD', label: 'Leads', icon: TrendingUp },
    { value: 'CONTACT', label: 'Contacts', icon: BookUser },
    { value: 'SERVICE', label: 'Services', icon: Wrench },
    { value: 'CREDITOR', label: 'Creditors', icon: TrendingDown },
    { value: 'DEBTOR', label: 'Debtors', icon: TrendingUp },
]

export default function ContactTagsPage() {
    const [tags, setTags] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<any>(null)
    const [form, setForm] = useState({ name: '', color: '#6366F1', description: '', parent: '' as string, contact_type: '' })

    useEffect(() => { load() }, [])

    async function load() {
        setLoading(true)
        try { setTags(await getContactTags()) }
        finally { setLoading(false) }
    }

    function pick(tag: any | null) {
        setSelected(tag)
        setForm({
            name: tag?.name ?? '',
            color: tag?.color ?? '#6366F1',
            description: tag?.description ?? '',
            parent: tag?.parent ? String(tag.parent) : '',
            contact_type: tag?.contact_type ?? '',
        })
    }

    async function save() {
        if (!form.name.trim()) return toast.error('Category name is required')
        setSaving(true)
        try {
            const payload = { ...form, parent: form.parent ? Number(form.parent) : null, contact_type: form.contact_type || null }
            const res = selected
                ? await updateContactTag(selected.id, payload)
                : await createContactTag(payload)
            if (res?.error) { toast.error(res.error); return }
            toast.success(selected ? 'Category updated' : 'Category created')
            if (!selected) pick(null)
            load()
        } finally { setSaving(false) }
    }

    async function del(id: number) {
        if (!confirm('Delete this category? Contacts with this tag will be untagged.')) return
        const res = await deleteContactTag(id)
        if (res?.error) { toast.error(res.error); return }
        toast.success('Category deleted')
        if (selected?.id === id) pick(null)
        load()
    }

    const filtered = useMemo(() =>
        search ? tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase())) : tags,
        [tags, search]
    )

    // Build tree
    const tree = useMemo(() => {
        const map: Record<number, any> = {}
        tags.forEach(t => { map[t.id] = { ...t, children: [] } })
        const roots: any[] = []
        tags.forEach(t => { t.parent && map[t.parent] ? map[t.parent].children.push(map[t.id]) : roots.push(map[t.id]) })
        return roots
    }, [tags])

    return (
        <main className="animate-in fade-in duration-500 pb-24">
            <div className="layout-container-padding max-w-[1400px] mx-auto space-y-8 pt-6">

                {/* ── Header ── */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <FolderTree size={13} className="text-app-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">CRM Taxonomy</span>
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                            Partner <span className="bg-gradient-to-r from-app-primary to-indigo-500 bg-clip-text text-transparent">Categories</span>
                        </h1>
                        <p className="text-xs text-app-muted-foreground mt-1">
                            Organize your contacts with global and type-scoped categories.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/crm/contacts"
                            className="flex items-center gap-2 h-10 px-5 rounded-xl border border-app-border/50 bg-app-surface/50 text-app-muted-foreground hover:text-app-foreground text-[11px] font-black uppercase tracking-widest transition-all"
                        >
                            <ArrowLeft size={14} /> Back to Contacts
                        </Link>
                        <button
                            onClick={() => pick(null)}
                            className="flex items-center gap-2 h-10 px-6 rounded-xl bg-app-primary text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-app-primary/20 hover:bg-app-primary/90 transition-all"
                        >
                            <Plus size={14} /> New Category
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* ── LEFT: Category Tree ── */}
                    <div className="lg:col-span-7 space-y-4">

                        {/* Search */}
                        <div className="relative">
                            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground/40 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search categories..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full h-11 pl-11 pr-4 rounded-2xl bg-app-surface/60 border border-app-border/40 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/40 transition-all placeholder:text-app-muted-foreground/40"
                            />
                        </div>

                        {/* Stats Row */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-surface/60 border border-app-border/40">
                                <Tag size={12} className="text-app-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">{tags.length} categories</span>
                            </div>
                            {search && (
                                <span className="text-[10px] font-bold text-app-muted-foreground/60">{filtered.length} matching</span>
                            )}
                        </div>

                        {/* Tree */}
                        <div className="bg-app-surface/80 backdrop-blur-sm border border-app-border/40 rounded-2xl overflow-hidden shadow-lg shadow-app-primary/5 min-h-[480px]">
                            <div className="h-[2px] bg-gradient-to-r from-app-primary/60 via-indigo-500/40 to-transparent" />
                            <div className="p-4">
                                {loading ? (
                                    <div className="space-y-3 py-8">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className="h-12 rounded-xl bg-app-border/20 animate-pulse" />
                                        ))}
                                    </div>
                                ) : tree.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-24 text-center">
                                        <div className="w-16 h-16 rounded-2xl bg-app-border/20 flex items-center justify-center mb-4">
                                            <Tag size={28} className="text-app-muted-foreground/20" />
                                        </div>
                                        <p className="text-sm font-black uppercase tracking-widest text-app-muted-foreground">No categories yet</p>
                                        <p className="text-xs text-app-muted-foreground/60 mt-2">Click &ldquo;New Category&rdquo; to get started</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {(search ? filtered : tree).map(tag => (
                                            <TagRow
                                                key={tag.id}
                                                tag={tag}
                                                selectedId={selected?.id}
                                                onSelect={pick}
                                                onDelete={del}
                                                flat={!!search}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT: Editor ── */}
                    <div className="lg:col-span-5">
                        <div className="sticky top-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted-foreground/50 px-1 mb-3 flex items-center gap-3">
                                Category Editor
                                <span className="flex-1 h-px bg-app-border/40" />
                                {selected && (
                                    <span className="text-app-primary text-[9px]">Editing: {selected.name}</span>
                                )}
                            </p>

                            <div className="bg-app-surface/80 backdrop-blur-sm border border-app-border/40 rounded-2xl overflow-hidden shadow-xl shadow-app-primary/5">
                                <div className="h-[2px] bg-gradient-to-r from-app-primary/60 via-indigo-500/40 to-transparent" />
                                <div className="p-6 space-y-6">

                                    {/* Name */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">Category Name *</label>
                                        <div className="relative">
                                            <Type size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-primary/50 pointer-events-none" />
                                            <input
                                                type="text"
                                                value={form.name}
                                                onChange={e => setForm({ ...form, name: e.target.value })}
                                                onKeyDown={e => e.key === 'Enter' && save()}
                                                placeholder="e.g. Wholesale Importers"
                                                className="w-full h-11 pl-10 pr-4 rounded-xl bg-app-background border border-app-border/40 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-app-primary/20 transition-all placeholder:text-app-muted-foreground/30"
                                            />
                                        </div>
                                    </div>

                                    {/* Color + Type */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">Badge Color</label>
                                            <div className="flex items-center gap-3 h-11 px-4 rounded-xl bg-app-background border border-app-border/40">
                                                <input
                                                    type="color"
                                                    value={form.color}
                                                    onChange={e => setForm({ ...form, color: e.target.value })}
                                                    className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-none shrink-0"
                                                />
                                                <span className="font-mono text-[10px] font-black uppercase text-app-muted-foreground">{form.color}</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">Contact Type</label>
                                            <select
                                                value={form.contact_type}
                                                onChange={e => setForm({ ...form, contact_type: e.target.value })}
                                                className="w-full h-11 px-3 rounded-xl bg-app-background border border-app-border/40 text-[11px] font-black uppercase appearance-none focus:outline-none focus:ring-2 focus:ring-app-primary/20 transition-all"
                                            >
                                                {TYPE_OPTS.map(o => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Parent */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">Parent Category</label>
                                        <select
                                            value={form.parent}
                                            onChange={e => setForm({ ...form, parent: e.target.value })}
                                            className="w-full h-11 px-3 rounded-xl bg-app-background border border-app-border/40 text-[11px] font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-app-primary/20 transition-all"
                                        >
                                            <option value="">No parent (Root category)</option>
                                            {tags.filter(t => t.id !== selected?.id).map(t => (
                                                <option key={t.id} value={String(t.id)}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-2">Description</label>
                                        <textarea
                                            value={form.description}
                                            onChange={e => setForm({ ...form, description: e.target.value })}
                                            rows={3}
                                            placeholder="Internal notes about this category..."
                                            className="w-full px-4 py-3 rounded-xl bg-app-background border border-app-border/40 text-xs font-medium resize-none focus:outline-none focus:ring-2 focus:ring-app-primary/20 transition-all placeholder:text-app-muted-foreground/30"
                                        />
                                    </div>

                                    {/* Preview */}
                                    {form.name && (
                                        <div className="flex items-center gap-3 p-4 rounded-xl bg-app-background/60 border border-app-border/30">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground/50">Preview:</span>
                                            <span
                                                className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-sm"
                                                style={{ backgroundColor: form.color }}
                                            >
                                                {form.name}
                                            </span>
                                            <span className="text-[9px] font-bold text-app-muted-foreground/40 uppercase">
                                                {form.contact_type || 'GLOBAL'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-3 pt-2">
                                        {selected && (
                                            <button
                                                onClick={() => pick(null)}
                                                className="h-11 px-5 rounded-xl border border-app-border/50 text-app-muted-foreground text-[11px] font-black uppercase tracking-widest hover:bg-app-background transition-all"
                                            >
                                                New
                                            </button>
                                        )}
                                        <button
                                            onClick={save}
                                            disabled={saving || !form.name.trim()}
                                            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-app-primary to-indigo-500 text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-app-primary/20 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                                        >
                                            {saving
                                                ? <><RefreshCw size={14} className="animate-spin" /> Saving...</>
                                                : <><Save size={14} /> {selected ? 'Update Category' : 'Create Category'}</>
                                            }
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Quick stats */}
                            {tags.length > 0 && (
                                <div className="mt-4 grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Total', value: tags.length },
                                        { label: 'Global', value: tags.filter(t => !t.contact_type).length },
                                        { label: 'Typed', value: tags.filter(t => !!t.contact_type).length },
                                    ].map(s => (
                                        <div key={s.label} className="bg-app-surface/60 border border-app-border/40 rounded-xl p-3 text-center">
                                            <p className="text-lg font-black text-app-primary">{s.value}</p>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground/60">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}

function TagRow({ tag, selectedId, onSelect, onDelete, depth = 0, flat = false }: any) {
    const [open, setOpen] = useState(true)
    const active = selectedId === tag.id
    const hasKids = !flat && tag.children?.length > 0

    return (
        <div>
            <div
                className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer group transition-all border ${active
                        ? 'bg-app-primary/10 border-app-primary/30 text-app-foreground'
                        : 'bg-transparent border-transparent hover:bg-app-background/60 hover:border-app-border/30'
                    }`}
                style={{ marginLeft: flat ? 0 : `${depth * 20}px` }}
                onClick={() => onSelect(tag)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {/* expand/collapse */}
                    {hasKids ? (
                        <button
                            className="w-5 h-5 flex items-center justify-center text-app-muted-foreground/40 hover:text-app-foreground shrink-0"
                            onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
                        >
                            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                    ) : (
                        <span className="w-5 h-5 flex items-center justify-center shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-app-border/40" />
                        </span>
                    )}

                    {/* dot */}
                    <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: tag.color || '#6366F1' }}
                    />

                    {/* name */}
                    <span className={`text-[12px] font-bold truncate ${active ? 'text-app-primary' : 'text-app-foreground'}`}>
                        {tag.name}
                    </span>

                    {/* scope badge */}
                    <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground/40 shrink-0">
                        {tag.contact_type || 'GLOBAL'}
                    </span>
                </div>

                {/* actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(tag.id) }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted-foreground/30 hover:bg-app-error/10 hover:text-app-error transition-all"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* children */}
            {hasKids && open && (
                <div className="mt-1 space-y-1">
                    {tag.children.map((child: any) => (
                        <TagRow
                            key={child.id}
                            tag={child}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            onDelete={onDelete}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
