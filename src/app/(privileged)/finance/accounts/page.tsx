'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import {
    Wallet, Plus, Search, ChevronDown, ChevronRight, Loader2, Maximize2, Minimize2,
    Settings2, Monitor, Link as LinkIcon, FolderTree, Power
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { getFinancialAccounts, getAccountCategories, deleteFinancialAccount, togglePosAccess } from './actions'
import { CategoryGroup, UncategorizedGroup } from './_components/CategoryGroup'

export default function FinancialAccountsPage() {
    const [accounts, setAccounts] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [focusMode, setFocusMode] = useState(false)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    const load = async () => {
        try {
            const [accts, cats] = await Promise.all([getFinancialAccounts(), getAccountCategories()])
            setAccounts(Array.isArray(accts) ? accts : [])
            setCategories(Array.isArray(cats) ? cats : [])
            const ids = new Set((Array.isArray(cats) ? cats : []).map((c: any) => `cat-${c.id}`))
            ids.add('cat-uncategorized')
            setExpanded(ids)
        } catch { toast.error('Failed to load accounts') }
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    /* ── Group accounts by category ── */
    const { grouped, uncategorized } = useMemo(() => {
        const q = searchQuery.toLowerCase()
        const filtered = accounts.filter(a =>
            !q || a.name?.toLowerCase().includes(q) || a.type?.toLowerCase().includes(q) ||
            a.categoryData?.name?.toLowerCase().includes(q) || a.ledgerAccount?.code?.toLowerCase().includes(q)
        )
        const map = new Map<number, any[]>()
        const uncat: any[] = []
        for (const a of filtered) {
            const catId = a.category || a.categoryData?.id
            if (catId) {
                if (!map.has(catId)) map.set(catId, [])
                map.get(catId)!.push(a)
            } else { uncat.push(a) }
        }
        return { grouped: map, uncategorized: uncat }
    }, [accounts, searchQuery])

    const totalAccounts = accounts.length
    const activeAccounts = accounts.filter(a => a.is_active !== false).length
    const posEnabled = accounts.filter(a => a.is_pos_enabled).length
    const withCOA = accounts.filter(a => a.ledgerAccount).length
    const totalCategories = categories.length

    const toggleExpand = (key: string) => {
        setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
    }
    const expandAll = () => {
        const ids = new Set(categories.map(c => `cat-${c.id}`)); ids.add('cat-uncategorized'); setExpanded(ids)
    }
    const collapseAll = () => setExpanded(new Set())

    const confirmDelete = async () => {
        if (!deleteTarget) return
        try { await deleteFinancialAccount(deleteTarget); toast.success('Account deleted'); load() }
        catch (e: any) { toast.error(e?.message || 'Failed to delete') }
        setDeleteTarget(null)
    }

    const handlePosToggle = async (id: number, current: boolean) => {
        try { await togglePosAccess(id, !current); toast.success(current ? 'POS disabled' : 'POS enabled'); load() }
        catch { toast.error('Failed to toggle POS') }
    }

    if (loading) return (
        <div className="flex items-center justify-center py-32">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--app-primary)', opacity: 0.6 }} />
        </div>
    )

    const kpis = [
        { label: 'Total Accounts', value: totalAccounts, color: 'var(--app-primary)', icon: <Wallet size={14} /> },
        { label: 'Active', value: activeAccounts, color: 'var(--app-success, #22c55e)', icon: <Power size={14} /> },
        { label: 'POS Enabled', value: posEnabled, color: '#8b5cf6', icon: <Monitor size={14} /> },
        { label: 'COA Linked', value: withCOA, color: 'var(--app-info, #3b82f6)', icon: <LinkIcon size={14} /> },
        { label: 'Categories', value: totalCategories, color: 'var(--app-warning, #f59e0b)', icon: <FolderTree size={14} /> },
    ]

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>

            {/* ── Header ── */}
            {!focusMode ? (
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Wallet size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                                Financial <span style={{ color: 'var(--app-primary)' }}>Accounts</span>
                            </h1>
                            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                {totalAccounts} accounts · {totalCategories} categories
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/finance/account-categories">
                            <button className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                <Settings2 size={13} /><span className="hidden md:inline">Categories</span>
                            </button>
                        </Link>
                        <Link href="/finance/accounts/new">
                            <button className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                <Plus size={14} /><span className="hidden sm:inline">New Account</span>
                            </button>
                        </Link>
                        <button onClick={() => setFocusMode(true)} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <Maximize2 size={13} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center"><Wallet size={14} className="text-white" /></div>
                        <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Accounts</span>
                        <span className="text-[10px] font-bold text-app-muted-foreground">{totalAccounts}</span>
                    </div>
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search... (Ctrl+K)"
                            className="w-full pl-9 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                    </div>
                    <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                        <Minimize2 size={13} />
                    </button>
                </div>
            )}

            {/* ── KPI Strip ── */}
            {!focusMode && (
                <div className="mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    {kpis.map(s => (
                        <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Search + Controls ── */}
            {!focusMode && (
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by name, type, category... (Ctrl+K)"
                            className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                    </div>
                    <button onClick={expandAll} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                        <ChevronDown size={13} /><span className="hidden sm:inline">Expand</span>
                    </button>
                    <button onClick={collapseAll} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                        <ChevronRight size={13} /><span className="hidden sm:inline">Collapse</span>
                    </button>
                </div>
            )}

            {/* ── Tree Container ── */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="w-5 flex-shrink-0" /><div className="w-7 flex-shrink-0" />
                    <div className="flex-1 min-w-0">Name</div>
                    <div className="hidden sm:block w-24 flex-shrink-0">COA Link</div>
                    <div className="hidden md:block w-16 flex-shrink-0 text-center">POS</div>
                    <div className="hidden md:block w-16 flex-shrink-0 text-center">Users</div>
                    <div className="w-28 text-right flex-shrink-0">Balance</div>
                    <div className="w-16 flex-shrink-0" />
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {totalAccounts === 0 && categories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <Wallet size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No financial accounts yet</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">Create categories first, then add accounts under each.</p>
                        </div>
                    ) : (
                        <>
                            {categories.map(cat => {
                                const catAccounts = grouped.get(cat.id) || []
                                if (searchQuery && catAccounts.length === 0) return null
                                return (
                                    <CategoryGroup key={cat.id} category={cat} accounts={catAccounts}
                                        isOpen={expanded.has(`cat-${cat.id}`)} onToggle={() => toggleExpand(`cat-${cat.id}`)}
                                        onDeleteAccount={id => setDeleteTarget(id)} onTogglePOS={handlePosToggle} />
                                )
                            })}
                            <UncategorizedGroup accounts={uncategorized}
                                isOpen={expanded.has('cat-uncategorized')} onToggle={() => toggleExpand('cat-uncategorized')}
                                onDeleteAccount={id => setDeleteTarget(id)} onTogglePOS={handlePosToggle} />
                        </>
                    )}
                </div>
            </div>

            <ConfirmDialog open={deleteTarget !== null} onOpenChange={o => { if (!o) setDeleteTarget(null) }}
                onConfirm={confirmDelete} title="Delete Financial Account?"
                description="If this account has transactions, it will be deactivated instead." variant="danger" />
        </div>
    )
}