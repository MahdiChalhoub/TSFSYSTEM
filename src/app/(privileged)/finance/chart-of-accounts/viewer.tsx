'use client'

import { useState, useMemo, useTransition, useCallback, useRef, useEffect } from 'react'
import type { ChartOfAccount } from '@/types/erp'
import {
    ChevronRight, ChevronDown, Plus, Folder, FolderOpen, FileText,
    RefreshCcw, Library, Eye, EyeOff, Pencil, X, Power,
    Search, Filter, BarChart3, BookOpen, Layers, TrendingUp,
    TrendingDown, Activity, ArrowUpRight, ChevronUp,
    MoreHorizontal, Copy, Trash2, Download, Hash,
    Database, Scale, Wand2, FileCode, CaseSensitive, TextSearch,
    Maximize2, Minimize2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { recalculateAccountBalances } from '@/app/actions/finance/ledger'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/* ═══════════════════════════════════════════════════════════
 *  TYPE CONSTANTS
 * ═══════════════════════════════════════════════════════════ */
const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    ASSET: { label: 'Asset', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <TrendingUp size={11} /> },
    LIABILITY: { label: 'Liability', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: <TrendingDown size={11} /> },
    EQUITY: { label: 'Equity', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', icon: <Layers size={11} /> },
    INCOME: { label: 'Income', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: <ArrowUpRight size={11} /> },
    EXPENSE: { label: 'Expense', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: <Activity size={11} /> },
}

/* ═══════════════════════════════════════════════════════════
 *  ACCOUNT TREE NODE (Recursive)
 * ═══════════════════════════════════════════════════════════ */
interface TreeNode extends Record<string, any> {
    id: number
    code: string
    name: string
    type: string
    balance: number
    children: TreeNode[]
    isActive: boolean
}

const AccountNode = ({
    node, level, onEdit, onAdd, onReactivate, searchQuery
}: {
    node: TreeNode; level: number; searchQuery: string;
    onEdit: (n: TreeNode) => void; onAdd: (id?: number) => void; onReactivate: (id: number) => void
}) => {
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(level < 1)
    const typeConf = TYPE_CONFIG[node.type] || TYPE_CONFIG.ASSET

    // Auto-expand when searching
    useEffect(() => {
        if (searchQuery) setIsOpen(true)
    }, [searchQuery])

    // Show aggregated balance (own + all nested children)
    const aggregatedBalance = useMemo(() => {
        const sumTree = (n: TreeNode): number => {
            const own = n.balance ?? 0
            const childrenSum = (n.children || []).reduce((s, c) => s + sumTree(c), 0)
            return own + childrenSum
        }
        return sumTree(node)
    }, [node])

    const displayBalance = isParent ? aggregatedBalance : (node.balance ?? 0)
    const isNegative = displayBalance < 0

    return (
        <div className={`${!node.isActive ? 'opacity-40' : ''}`}>
            {/* ── ROW ── */}
            <div
                className={`
          group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-default
          border-b border-app-border/30
          ${level === 0
                        ? 'bg-app-surface/80 hover:bg-app-surface py-2.5 md:py-3'
                        : 'hover:bg-app-surface/40 py-1.5 md:py-2'
                    }
        `}
                style={{ paddingLeft: `${12 + level * 20}px`, paddingRight: '12px' }}
            >
                {/* Toggle */}
                <button
                    onClick={() => isParent && setIsOpen(!isOpen)}
                    className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${isParent ? 'hover:bg-app-border/50 text-app-text-muted' : 'text-app-border'
                        }`}
                >
                    {isParent ? (
                        isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-app-border" />
                    )}
                </button>

                {/* Icon */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isParent ? 'bg-amber-500/10 text-amber-400' : 'bg-app-border/30 text-app-text-muted'
                    }`}>
                    {isParent ? (isOpen ? <FolderOpen size={14} /> : <Folder size={14} />) : <FileText size={13} />}
                </div>

                {/* Code + Name */}
                <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                    <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-app-bg/60 flex-shrink-0 ${level === 0 ? 'text-app-primary' : 'text-app-text'
                        }`}>
                        {node.code}
                    </span>
                    <span className={`truncate text-[13px] ${level === 0 ? 'font-bold text-app-text' : 'font-medium text-app-text'
                        }`}>
                        {node.name}
                    </span>
                    {node.subType && (
                        <span className="hidden md:inline text-[9px] font-bold text-app-text-faint uppercase tracking-wider bg-app-border/30 px-1.5 py-0.5 rounded flex-shrink-0">
                            {node.subType}
                        </span>
                    )}
                    {!node.isActive && (
                        <span className="text-[8px] font-black text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded uppercase flex-shrink-0">OFF</span>
                    )}
                </div>

                {/* SYSCOHADA (desktop) */}
                <div className="hidden lg:flex w-36 items-center gap-1 flex-shrink-0">
                    {node.syscohadaCode && (
                        <span className="text-[10px] font-mono font-bold bg-app-bg/80 text-app-text-muted px-1.5 py-0.5 rounded border border-app-border/50">
                            {node.syscohadaCode}
                        </span>
                    )}
                </div>

                {/* Type Badge */}
                <div className="hidden sm:flex w-24 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeConf.color} ${typeConf.bg} ${typeConf.border}`}>
                        {typeConf.icon}
                        <span className="hidden xl:inline">{typeConf.label}</span>
                    </span>
                </div>

                {/* Balance */}
                <div className={`w-28 text-right font-mono text-[12px] font-bold flex-shrink-0 tabular-nums ${isNegative ? 'text-rose-400' : displayBalance > 0 ? 'text-app-text' : 'text-app-text-faint'
                    }`}>
                    {displayBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(node)}
                        className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-text-muted hover:text-app-text transition-colors"
                        title="Edit"
                    >
                        <Pencil size={12} />
                    </button>
                    <button
                        onClick={() => onAdd(node.id)}
                        className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-text-muted hover:text-app-primary transition-colors"
                        title="Add sub-account"
                    >
                        <Plus size={13} />
                    </button>
                    {!node.isActive && (
                        <button
                            onClick={() => onReactivate(node.id)}
                            className="p-1.5 hover:bg-app-primary-light rounded-lg text-app-text-muted hover:text-app-primary transition-colors"
                            title="Reactivate"
                        >
                            <Power size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── CHILDREN ── */}
            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children.map((child) => (
                        <AccountNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            onEdit={onEdit}
                            onAdd={onAdd}
                            onReactivate={onReactivate}
                            searchQuery={searchQuery}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN VIEWER
 * ═══════════════════════════════════════════════════════════ */
export function ChartOfAccountsViewer({ accounts }: { accounts: Record<string, any>[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [isAdding, setIsAdding] = useState(false)
    const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null)
    const [preselectedParentId, setPreselectedParentId] = useState<number | undefined>(undefined)
    const [showInactive, setShowInactive] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [exactSearch, setExactSearch] = useState(true)
    const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null)
    const [focusMode, setFocusMode] = useState(false)
    const [pendingAction, setPendingAction] = useState<{ type: string; title: string; description: string; variant: 'danger' | 'warning' | 'info'; id?: number } | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    // ─── Keyboard shortcut: Cmd+K to focus search ───
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                searchRef.current?.focus()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // ─── Build hierarchical tree with filters ───
    const { tree, stats } = useMemo(() => {
        let filtered = showInactive ? accounts : accounts.filter(a => a.isActive)

        if (activeTypeFilter) {
            filtered = filtered.filter(a => a.type === activeTypeFilter)
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            if (exactSearch) {
                // Exact code prefix match: "110" → codes starting with "110"
                filtered = filtered.filter(a =>
                    a.code?.toLowerCase().startsWith(q)
                )
            } else {
                // Fuzzy search: match in code, name, or SYSCOHADA
                filtered = filtered.filter(a =>
                    a.name?.toLowerCase().includes(q) ||
                    a.code?.toLowerCase().includes(q) ||
                    a.syscohadaCode?.toLowerCase().includes(q)
                )
            }
        }

        const dataMap: Record<string, TreeNode> = {}
        filtered.forEach(acc => {
            dataMap[acc.id] = { ...acc, children: [] } as TreeNode
        })

        const rootNodes: TreeNode[] = []
        filtered.forEach(acc => {
            if (acc.parentId && dataMap[acc.parentId]) {
                dataMap[acc.parentId].children.push(dataMap[acc.id])
            } else {
                rootNodes.push(dataMap[acc.id])
            }
        })

        // Sort children by code
        const sortChildren = (nodes: TreeNode[]) => {
            nodes.sort((a, b) => (a.code || '').localeCompare(b.code || ''))
            nodes.forEach(n => sortChildren(n.children))
        }
        sortChildren(rootNodes)

        // Stats
        const sumAllBalances = (nodes: TreeNode[]): number => {
            return nodes.reduce((sum, n) => {
                return sum + (n.balance ?? 0) + sumAllBalances(n.children)
            }, 0)
        }
        const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0)
        const filteredBalance = sumAllBalances(rootNodes)
        const typeCounts = accounts.reduce((map, a) => {
            map[a.type] = (map[a.type] || 0) + 1
            return map
        }, {} as Record<string, number>)
        const inactiveCount = accounts.filter(a => !a.isActive).length

        return {
            tree: rootNodes,
            stats: { totalBalance, filteredBalance, typeCounts, inactiveCount, total: accounts.length, filtered: filtered.length }
        }
    }, [accounts, showInactive, searchQuery, exactSearch, activeTypeFilter])

    // ─── Dynamic Sub-Types (read from existing accounts + built-in) ───
    const subTypeOptions = useMemo(() => {
        const builtIn = ['CASH', 'BANK', 'RECEIVABLE', 'PAYABLE']
        const fromData = accounts
            .map(a => a.subType)
            .filter((v): v is string => !!v && v.trim() !== '')
        const all = new Set([...builtIn, ...fromData])
        return Array.from(all).sort()
    }, [accounts])

    // ─── Actions ───
    const openAddModal = useCallback((parentId?: number) => {
        setPreselectedParentId(parentId)
        setIsAdding(true)
    }, [])

    const openEditModal = useCallback((account: Record<string, any>) => {
        setEditingAccount(account as unknown as ChartOfAccount)
    }, [])

    const reactivateAccount = useCallback((id: number) => {
        setPendingAction({
            type: 'reactivate',
            title: 'Reactivate Account?',
            description: 'This will restore this deactivated account to active status.',
            variant: 'warning',
            id,
        })
    }, [])

    const handleConfirmAction = () => {
        if (!pendingAction) return
        if (pendingAction.type === 'reactivate' && pendingAction.id) {
            startTransition(async () => {
                const { reactivateChartOfAccount } = await import('@/app/actions/finance/accounts')
                try {
                    await reactivateChartOfAccount(pendingAction.id!)
                    router.refresh()
                    toast.success('Account reactivated.')
                } catch (e: unknown) {
                    toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
                }
            })
        } else if (pendingAction.type === 'recalculate') {
            startTransition(async () => {
                await recalculateAccountBalances()
                router.refresh()
                toast.success('Balances recalculated successfully.')
            })
        }
        setPendingAction(null)
    }

    async function handleCreate(formData: FormData) {
        const code = formData.get('code') as string
        const name = formData.get('name') as string
        const type = formData.get('type') as string
        const subType = formData.get('subType') as string
        const parentId = formData.get('parentId') ? parseInt(formData.get('parentId') as string) : undefined
        const syscohadaCode = formData.get('syscohadaCode') as string
        const syscohadaClass = formData.get('syscohadaClass') as string

        startTransition(async () => {
            const { createAccount } = await import('@/app/actions/finance/accounts')
            try {
                await createAccount({ code, name, type, subType, parentId, syscohadaCode, syscohadaClass })
                setIsAdding(false)
                setPreselectedParentId(undefined)
                router.refresh()
                toast.success('Account created successfully.')
            } catch (e: unknown) {
                toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
            }
        })
    }

    async function handleUpdate(formData: FormData) {
        if (!editingAccount) return
        const code = formData.get('code') as string
        const name = formData.get('name') as string
        const type = formData.get('type') as string
        const subType = formData.get('subType') as string
        const parentId = formData.get('parentId') ? parseInt(formData.get('parentId') as string) : null
        const syscohadaCode = formData.get('syscohadaCode') as string
        const syscohadaClass = formData.get('syscohadaClass') as string

        startTransition(async () => {
            const { updateChartOfAccount } = await import('@/app/actions/finance/accounts')
            try {
                await updateChartOfAccount(editingAccount.id, {
                    code, name, type, subType, parentId, syscohadaCode, syscohadaClass, isActive: true
                })
                setEditingAccount(null)
                router.refresh()
                toast.success('Account updated.')
            } catch (err: unknown) {
                toast.error('Update Error: ' + (err instanceof Error ? err.message : String(err)))
            }
        })
    }

    return (
        <div className={`flex flex-col h-full animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>

            {/* ═══════════════════════════════════════════════════════
       *  HEADER
       * ═══════════════════════════════════════════════════════ */}
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

                {/* ── FOCUS MODE: Compact bar ── */}
                {focusMode ? (
                    <div className="flex items-center gap-2">
                        {/* Compact title */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                                <BookOpen size={14} className="text-white" />
                            </div>
                            <span className="text-[12px] font-black text-app-text hidden sm:inline">COA</span>
                            <span className="text-[10px] font-bold text-app-text-faint">{stats.filtered}/{stats.total}</span>
                        </div>

                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-text-faint" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={exactSearch ? 'Code search...' : 'Search...'}
                                className="w-full pl-8 pr-20 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-text placeholder:text-app-text-faint focus:bg-app-surface focus:border-app-border outline-none transition-all"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <button
                                    onClick={() => setExactSearch(!exactSearch)}
                                    className={`text-[8px] font-bold px-1 py-0.5 rounded border transition-all ${exactSearch ? 'bg-app-primary/10 text-app-primary border-app-primary/20' : 'bg-app-bg/60 text-app-text-faint border-app-border/50'}`}
                                >
                                    {exactSearch ? '#' : '~'}
                                </button>
                            </div>
                        </div>

                        {/* Quick actions */}
                        <button onClick={() => openAddModal()}
                            className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0"
                        >
                            <Plus size={12} />
                            <span className="hidden sm:inline">New</span>
                        </button>

                        {/* Minimize button */}
                        <button
                            onClick={() => setFocusMode(false)}
                            title="Exit focus mode"
                            className="p-1.5 rounded-lg border border-app-border text-app-text-muted hover:text-app-text hover:bg-app-surface transition-all flex-shrink-0"
                        >
                            <Minimize2 size={13} />
                        </button>
                    </div>
                ) : (
                    /* ── NORMAL MODE: Full header ── */
                    <>
                        {/* Title Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                    <BookOpen size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-lg md:text-xl font-black text-app-text tracking-tight">
                                        Chart of Accounts
                                    </h1>
                                    <p className="text-[10px] md:text-[11px] font-bold text-app-text-faint uppercase tracking-widest">
                                        {stats.total} Accounts · Double-Entry Enforced
                                    </p>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                <button
                                    onClick={() => router.push('/finance/chart-of-accounts/templates')}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-text-muted hover:text-app-text border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <Wand2 size={13} />
                                    <span className="hidden md:inline">Wizard</span>
                                </button>
                                <button
                                    onClick={() => router.push('/finance/chart-of-accounts/migrate')}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-text-muted hover:text-app-text border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <Database size={13} />
                                    <span className="hidden md:inline">Migration</span>
                                </button>
                                <button
                                    onClick={() => router.push('/finance/settings/posting-rules')}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-text-muted hover:text-app-text border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <FileCode size={13} />
                                    <span className="hidden md:inline">Posting Rules</span>
                                </button>
                                <button
                                    onClick={() => router.push('/finance/chart-of-accounts/templates')}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-text-muted hover:text-app-text border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <Library size={13} />
                                    <span className="hidden md:inline">Templates</span>
                                </button>
                                <button
                                    onClick={() => setPendingAction({
                                        type: 'recalculate',
                                        title: 'Recalculate Balances?',
                                        description: 'Rebuilds all account balances from posted journal entries.',
                                        variant: 'danger',
                                    })}
                                    disabled={isPending}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-text-muted hover:text-app-text border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all disabled:opacity-50"
                                >
                                    <RefreshCcw size={13} className={isPending ? 'animate-spin' : ''} />
                                    <span className="hidden md:inline">Audit</span>
                                </button>
                                <button
                                    onClick={() => openAddModal()}
                                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                                >
                                    <Plus size={14} />
                                    <span className="hidden sm:inline">New Account</span>
                                </button>
                                {/* Focus Mode toggle */}
                                <button
                                    onClick={() => setFocusMode(true)}
                                    title="Focus mode — maximize table"
                                    className="flex items-center gap-1 text-[11px] font-bold text-app-text-muted hover:text-app-text border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <Maximize2 size={13} />
                                </button>
                            </div>
                        </div>

                        {/* KPI Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                            {Object.entries(TYPE_CONFIG).map(([type, conf]) => {
                                const count = stats.typeCounts[type] || 0
                                const isActive = activeTypeFilter === type
                                return (
                                    <button
                                        key={type}
                                        onClick={() => setActiveTypeFilter(isActive ? null : type)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left ${isActive
                                            ? `${conf.bg} ${conf.border} border-2 shadow-sm`
                                            : 'bg-app-surface/50 border-app-border/50 hover:bg-app-surface hover:border-app-border'
                                            }`}
                                    >
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${conf.bg} ${conf.color}`}>
                                            {conf.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <div className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? conf.color : 'text-app-text-faint'}`}>
                                                {conf.label}
                                            </div>
                                            <div className="text-sm font-black text-app-text tabular-nums">{count}</div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Search + Filters Bar */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-faint" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder={exactSearch ? 'Exact code search (e.g. 110, 2134)...' : 'Search by code, name, or SYSCOHADA...'}
                                    className="w-full pl-9 pr-28 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-text placeholder:text-app-text-faint focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button
                                        onClick={() => setExactSearch(!exactSearch)}
                                        title={exactSearch ? 'Exact code prefix (click for fuzzy)' : 'Fuzzy search (click for exact code)'}
                                        className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md border transition-all ${exactSearch
                                            ? 'bg-app-primary/10 text-app-primary border-app-primary/20'
                                            : 'bg-app-bg/60 text-app-text-faint border-app-border/50 hover:text-app-text-muted'
                                            }`}
                                    >
                                        {exactSearch ? <Hash size={10} /> : <TextSearch size={10} />}
                                        {exactSearch ? 'Exact' : 'Fuzzy'}
                                    </button>

                                </div>
                            </div>

                            {stats.inactiveCount > 0 && (
                                <button
                                    onClick={() => setShowInactive(!showInactive)}
                                    className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border transition-all flex-shrink-0 ${showInactive
                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                        : 'bg-app-surface/50 text-app-text-faint border-app-border/50 hover:text-app-text-muted'
                                        }`}
                                >
                                    {showInactive ? <Eye size={13} /> : <EyeOff size={13} />}
                                    <span className="hidden sm:inline">{showInactive ? 'Hiding' : 'Show'} Inactive</span>
                                    <span className="text-[10px] font-black bg-app-bg/60 px-1.5 py-0.5 rounded-md">{stats.inactiveCount}</span>
                                </button>
                            )}

                            {(searchQuery || activeTypeFilter) && (
                                <button
                                    onClick={() => { setSearchQuery(''); setActiveTypeFilter(null) }}
                                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300 px-2 py-2 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-all flex-shrink-0"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
            {/* ═══════════════════════════════════════════════════════
       *  ADD FORM (inline)
       * ═══════════════════════════════════════════════════════ */}
            {isAdding && (
                <div className="flex-shrink-0 mb-3 p-4 bg-app-surface border border-app-border rounded-2xl animate-in slide-in-from-top-2 duration-200" style={{ borderLeft: '3px solid var(--app-primary)' }}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[12px] font-black text-app-text uppercase tracking-wider">
                            {preselectedParentId ? 'New Sub-Account' : 'New Root Account'}
                        </h3>
                        <button onClick={() => setIsAdding(false)} className="p-1 hover:bg-app-border/50 rounded-lg transition-colors">
                            <X size={14} className="text-app-text-muted" />
                        </button>
                    </div>
                    <form action={handleCreate} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
                        <div>
                            <label className="text-[9px] font-black text-app-text-faint uppercase tracking-widest mb-1 block">Code</label>
                            <input name="code" placeholder="1010" required
                                className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-text placeholder:text-app-text-faint focus:border-app-primary/50 outline-none" />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-[9px] font-black text-app-text-faint uppercase tracking-widest mb-1 block">Name</label>
                            <input name="name" placeholder="Account Name" required
                                className="w-full text-[12px] font-medium px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-text placeholder:text-app-text-faint focus:border-app-primary/50 outline-none" />
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-app-text-faint uppercase tracking-widest mb-1 block">Type</label>
                            <select name="type" className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-text outline-none">
                                <option value="ASSET">Asset</option>
                                <option value="LIABILITY">Liability</option>
                                <option value="EQUITY">Equity</option>
                                <option value="INCOME">Income</option>
                                <option value="EXPENSE">Expense</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-app-text-faint uppercase tracking-widest mb-1 block">Sub-Type</label>
                            <input name="subType" list="subtype-list-add" placeholder="Select or type..."
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-text placeholder:text-app-text-faint outline-none" />
                            <datalist id="subtype-list-add">
                                <option value="">None</option>
                                {subTypeOptions.map(st => <option key={st} value={st}>{st}</option>)}
                            </datalist>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-app-text-faint uppercase tracking-widest mb-1 block">Parent</label>
                            <select name="parentId" defaultValue={preselectedParentId || ''}
                                className="w-full text-[11px] font-mono px-2 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-text outline-none">
                                <option value="">(Root)</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-1.5">
                            <input name="syscohadaCode" placeholder="SYSC" className="w-1/3 text-[10px] font-mono px-1.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-text outline-none" />
                            <input name="syscohadaClass" placeholder="Class" className="w-2/3 text-[10px] px-1.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-text outline-none" />
                        </div>
                        <div className="col-span-2 sm:col-span-1 flex gap-1.5">
                            <button type="submit" disabled={isPending}
                                className="flex-1 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white py-2 rounded-xl transition-all disabled:opacity-50">
                                {isPending ? '...' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════
       *  TREE TABLE
       * ═══════════════════════════════════════════════════════ */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                {/* Column Headers */}
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-text-faint uppercase tracking-wider">
                    <div className="w-5 flex-shrink-0" />
                    <div className="w-7 flex-shrink-0" />
                    <div className="flex-1 min-w-0">Account</div>
                    <div className="hidden lg:block w-36 flex-shrink-0">SYSCOHADA</div>
                    <div className="hidden sm:block w-24 flex-shrink-0">Type</div>
                    <div className="w-28 text-right flex-shrink-0">Balance</div>
                    <div className="w-16 flex-shrink-0" />
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {tree.length > 0 ? (
                        tree.map((node) => (
                            <AccountNode
                                key={node.id}
                                node={node}
                                level={0}
                                onEdit={openEditModal}
                                onAdd={openAddModal}
                                onReactivate={reactivateAccount}
                                searchQuery={searchQuery}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-app-border/20 flex items-center justify-center mb-4">
                                <BookOpen size={24} className="text-app-text-faint" />
                            </div>
                            <p className="text-sm font-bold text-app-text-muted mb-1">
                                {searchQuery || activeTypeFilter ? 'No matching accounts' : 'No accounts defined'}
                            </p>
                            <p className="text-[11px] text-app-text-faint mb-4">
                                {searchQuery || activeTypeFilter
                                    ? 'Try adjusting your search or filter criteria.'
                                    : 'Start building your chart of accounts.'}
                            </p>
                            {!searchQuery && !activeTypeFilter && (
                                <button
                                    onClick={() => openAddModal()}
                                    className="text-[11px] font-bold bg-app-primary text-white px-4 py-2 rounded-xl hover:brightness-110 transition-all"
                                >
                                    <Plus size={13} className="inline mr-1" /> Create First Account
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ═══ FIXED TABLE FOOTER ═══ */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-app-border/50" style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))' }}>
                    {/* Left: Result count */}
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-app-text-muted">
                            {stats.filtered === stats.total
                                ? <>{stats.total} <span className="text-app-text-faint">accounts</span></>
                                : <>{stats.filtered} <span className="text-app-text-faint">of</span> {stats.total} <span className="text-app-text-faint">accounts</span></>
                            }
                        </span>
                        {searchQuery && (
                            <span className="text-[9px] font-bold text-app-primary bg-app-primary/10 px-2 py-0.5 rounded-md">
                                {exactSearch ? 'Code:' : 'Search:'} "{searchQuery}"
                            </span>
                        )}
                    </div>

                    {/* Right: Total balance */}
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <span className="text-[9px] font-black text-app-text-faint uppercase tracking-wider mr-2">Total Balance</span>
                            <span className={`font-mono text-[13px] font-black tabular-nums ${(searchQuery || activeTypeFilter ? stats.filteredBalance : stats.totalBalance) < 0
                                ? 'text-rose-400'
                                : 'text-app-text'
                                }`}>
                                {(searchQuery || activeTypeFilter ? stats.filteredBalance : stats.totalBalance)
                                    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
       *  EDIT MODAL
       * ═══════════════════════════════════════════════════════ */}
            {editingAccount && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150">
                    <div className="bg-app-surface rounded-2xl shadow-2xl shadow-black/40 w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-app-border/50">
                        {/* Modal Header */}
                        <div className="sticky top-0 z-10 p-4 md:p-5 border-b border-app-border/50 bg-app-surface/95 backdrop-blur-sm flex justify-between items-start rounded-t-2xl">
                            <div>
                                <h3 className="text-base md:text-lg font-black text-app-text tracking-tight">Edit Account</h3>
                                <p className="text-[10px] font-bold text-app-text-faint uppercase tracking-widest mt-0.5">
                                    {(editingAccount as any).code} · {(editingAccount as any).name}
                                </p>
                            </div>
                            <button onClick={() => setEditingAccount(null)} className="p-2 hover:bg-app-border/50 rounded-xl transition-colors">
                                <X size={16} className="text-app-text-muted" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form action={handleUpdate} className="p-4 md:p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-app-text-faint tracking-widest">Account Code</label>
                                    <input name="code" defaultValue={(editingAccount as any).code} required
                                        className="w-full p-2.5 bg-app-bg/50 border border-app-border/50 rounded-xl text-app-text font-mono font-bold text-sm focus:border-app-primary/50 focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-app-text-faint tracking-widest">Display Name</label>
                                    <input name="name" defaultValue={(editingAccount as any).name} required
                                        className="w-full p-2.5 bg-app-bg/50 border border-app-border/50 rounded-xl text-app-text font-bold text-sm focus:border-app-primary/50 focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-app-text-faint tracking-widest">Financial Type</label>
                                    <select name="type" defaultValue={(editingAccount as any).type}
                                        className="w-full p-2.5 bg-app-bg/50 border border-app-border/50 rounded-xl text-app-text font-bold text-sm outline-none">
                                        <option value="ASSET">Asset</option>
                                        <option value="LIABILITY">Liability</option>
                                        <option value="EQUITY">Equity</option>
                                        <option value="INCOME">Income</option>
                                        <option value="EXPENSE">Expense</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-app-text-faint tracking-widest">Sub-Type</label>
                                    <input name="subType" list="subtype-list-edit" defaultValue={(editingAccount as any).subType || ''}
                                        placeholder="Select or type..."
                                        className="w-full p-2.5 bg-app-bg/50 border border-app-border/50 rounded-xl text-app-text font-bold text-sm focus:border-app-primary/50 focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                                    <datalist id="subtype-list-edit">
                                        <option value="">Standard</option>
                                        {subTypeOptions.map(st => <option key={st} value={st}>{st}</option>)}
                                    </datalist>
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-[9px] font-black uppercase text-app-text-faint tracking-widest">Parent Account</label>
                                    <select name="parentId" defaultValue={(editingAccount as any).parentId || ''}
                                        className="w-full p-2.5 bg-app-bg/50 border border-app-border/50 rounded-xl text-app-text font-mono text-xs outline-none">
                                        <option value="">[ROOT]</option>
                                        {accounts.filter((a: any) => a.id !== (editingAccount as any).id).map((a: any) => (
                                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-app-text-faint tracking-widest">SYSCOHADA Code</label>
                                    <input name="syscohadaCode" defaultValue={(editingAccount as any).syscohadaCode || ''}
                                        className="w-full p-2.5 bg-app-bg/50 border border-app-border/50 rounded-xl text-app-text font-mono text-sm outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-app-text-faint tracking-widest">SYSCOHADA Class</label>
                                    <input name="syscohadaClass" defaultValue={(editingAccount as any).syscohadaClass || ''}
                                        className="w-full p-2.5 bg-app-bg/50 border border-app-border/50 rounded-xl text-app-text text-sm outline-none" />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setEditingAccount(null)}
                                    className="flex-1 py-2.5 rounded-xl border border-app-border/50 text-app-text-muted font-bold text-[12px] hover:bg-app-bg/50 transition-all">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isPending}
                                    className="flex-[2] py-2.5 rounded-xl bg-app-primary hover:brightness-110 text-white font-bold text-[12px] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                                    {isPending ? <RefreshCcw size={14} className="animate-spin" /> : null}
                                    {isPending ? 'Saving...' : 'Apply Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                open={pendingAction !== null}
                onOpenChange={(open) => { if (!open) setPendingAction(null) }}
                onConfirm={handleConfirmAction}
                title={pendingAction?.title ?? ''}
                description={pendingAction?.description ?? ''}
                confirmText="Confirm"
                variant={pendingAction?.variant ?? 'warning'}
            />
        </div>
    )
}