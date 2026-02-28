"use client"
import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, RefreshCw, Eye, CheckCircle2, RotateCcw, AlertTriangle, Package, Tag, Layers, Ruler, Users, ShoppingCart, Banknote, Building2, Globe, Database, XCircle, Loader2, ChevronRight, ArrowRight, DatabaseZap } from "lucide-react"
import { toast } from "sonner"
import { MigrationJob, ReviewEntity, ReviewData } from "./types"
import { getMigrationReview, getMigrationSamples, approveMigrationEntity, getAccountMapping, saveAccountMapping } from "../actions"
import { MigrationPipeline } from "./MigrationPipeline"
import { COAMappingModal } from "./COAMappingModal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

// Recreate missing ENTITY_LABELS locally for the dashboard
const ENTITY_LABELS: Record<string, string> = {
    UNIT: "Units of Measure",
    CATEGORY: "Categories",
    BRAND: "Brands",
    PRODUCT: "Products",
    CONTACT: "Contacts",
    TRANSACTION: "Transactions",
    ORDER_LINE: "Order Lines",
    ACCOUNT: "Financial Accounts",
    ACCOUNT_TRANSACTION: "Account Transactions",
    TAX_RATE: "Tax Rates",
    BUSINESS_LOCATION: "Locations",
    EXPENSE_CATEGORY: "Expense Categories",
    PRODUCT_VARIATION: "Variations",
    CUSTOMER_GROUP: "Customer Groups",
    ACCOUNT_TYPE: "Account Types",
    USER: "Users",
    CURRENCY: "Currencies",
    COMBO_LINK: "Combo Links",
    EXPENSE: "Expenses",
    PAYMENT: "Payments",
    STOCK_ADJUSTMENT: "Stock Adjustments",
    STOCK_TRANSFER: "Stock Transfers",
    JOURNAL_ENTRY: "Journal Entries",
    INVENTORY: "Inventory"
}

// Recreate missing ENTITY_COLORS locally
const ENTITY_COLORS: Record<string, string> = {
    UNIT: "text-cyan-600", CATEGORY: "text-blue-600", BRAND: "text-indigo-600",
    PRODUCT: "text-purple-600", CONTACT: "text-pink-600", TRANSACTION: "text-amber-600",
    ORDER_LINE: "text-orange-600", ACCOUNT: "text-emerald-600", ACCOUNT_TRANSACTION: "text-teal-600",
    TAX_RATE: "text-neutral-600", BUSINESS_LOCATION: "text-sky-600", EXPENSE_CATEGORY: "text-rose-600",
    PRODUCT_VARIATION: "text-fuchsia-600", CUSTOMER_GROUP: "text-violet-600", ACCOUNT_TYPE: "text-lime-600",
    USER: "text-slate-600", CURRENCY: "text-yellow-600", COMBO_LINK: "text-stone-600",
}

const entityGroupMeta: Record<string, { icon: any, gradient: string }> = {
    config: { icon: Ruler, gradient: "from-blue-500/20 to-cyan-500/20" },
    catalog: { icon: Package, gradient: "from-purple-500/20 to-pink-500/20" },
    people: { icon: Users, gradient: "from-indigo-500/20 to-blue-500/20" },
    finance: { icon: Banknote, gradient: "from-emerald-500/20 to-teal-500/20" },
    transactions: { icon: ShoppingCart, gradient: "from-amber-500/20 to-orange-500/20" },
    other: { icon: Globe, gradient: "from-gray-500/20 to-gray-400/20" },
}

const GROUP_ICONS: Record<string, { icon: any, gradient: string }> = {
    infrastructure: { icon: Ruler, gradient: "from-blue-500/20 to-cyan-500/20" },
    master_data: { icon: Layers, gradient: "from-indigo-500/20 to-blue-500/20" },
    products: { icon: Package, gradient: "from-purple-500/20 to-pink-500/20" },
    partners: { icon: Users, gradient: "from-sky-500/20 to-indigo-500/20" },
    finance: { icon: Banknote, gradient: "from-emerald-500/20 to-teal-500/20" },
    transactions: { icon: ShoppingCart, gradient: "from-amber-500/20 to-orange-500/20" },
    other: { icon: Globe, gradient: "from-gray-500/20 to-gray-400/20" },
}

const ENTITY_ICONS: Record<string, any> = {
    UNIT: Ruler, CATEGORY: Layers, BRAND: Tag, PRODUCT: Package,
    CONTACT: Users, TRANSACTION: ShoppingCart, ORDER_LINE: ShoppingCart,
    ACCOUNT: Banknote, ACCOUNT_TRANSACTION: Banknote, TAX_RATE: Banknote,
    BUSINESS_LOCATION: Building2, EXPENSE_CATEGORY: Banknote,
    PRODUCT_VARIATION: Package, CUSTOMER_GROUP: Users, ACCOUNT_TYPE: Banknote,
    USER: Users, CURRENCY: Globe, COMBO_LINK: Layers,
    EXPENSE: Banknote, PAYMENT: Banknote,
    STOCK_ADJUSTMENT: Package, STOCK_TRANSFER: Package,
    JOURNAL_ENTRY: Database, INVENTORY: Package,
}

export function MigrationReviewDashboard({ job, goBack, onRollback }: { job: MigrationJob; goBack: () => void; onRollback: () => void }) {
    const router = useRouter()
    const [review, setReview] = useState<ReviewData | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<"overview" | "errors">("overview")
    const [approving, setApproving] = useState<string | null>(null)
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
    const [showAllErrors, setShowAllErrors] = useState(false)
    const [auditEntity, setAuditEntity] = useState<string | null>(null)
    const [auditSamples, setAuditSamples] = useState<any[] | null>(null)
    const [loadingSamples, setLoadingSamples] = useState(false)

    // Account Mapping State
    const [showAccountMapping, setShowAccountMapping] = useState(false)
    const [mappingData, setMappingData] = useState<any>(null)
    const [savingMapping, setSavingMapping] = useState(false)

    const fetchAccountMappingData = async () => {
        try {
            const data = await getAccountMapping(job.id)
            setMappingData(data)
            setShowAccountMapping(true)
        } catch (err) {
            toast.error("Failed to fetch account mapping data")
        }
    }

    const handleSaveAccountMapping = async (mappings: any[]) => {
        setSavingMapping(true)
        try {
            await saveAccountMapping(job.id, mappings)
            toast.success("Account mappings saved successfully")
            setShowAccountMapping(false)
            fetchReview() // Refresh review to update draft counts
        } catch (err) {
            toast.error("Failed to save account mappings")
        } finally {
            setSavingMapping(false)
        }
    }

    const fetchSamples = async (etype: string) => {
        setAuditEntity(etype)
        setLoadingSamples(true)
        try {
            const data = await getMigrationSamples(job.id, etype)
            setAuditSamples(data?.samples || [])
        } catch { setAuditSamples([]) }
        setLoadingSamples(false)
    }

    const fetchReview = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getMigrationReview(job.id)
            if (data) setReview(data)
        } catch { /* ignore */ }
        setLoading(false)
    }, [job.id])

    useEffect(() => { fetchReview() }, [fetchReview])

    const handleBulkApprove = async (entityType: string) => {
        if (!confirm(`Approve ALL draft ${ENTITY_LABELS[entityType] || entityType}? This will mark them as completed/posted.`)) return
        setApproving(entityType)
        try {
            await approveMigrationEntity(job.id, entityType)
            await fetchReview()
        } catch { /* ignore */ }
        setApproving(null)
    }

    const totalMappings = review?.total_mappings || 0
    const totalDraft = review?.total_draft || 0
    const totalGood = review?.total_good || 0
    const totalErrors = review?.total_errors || 0
    const healthPercent = totalMappings > 0 ? Math.round((totalGood / totalMappings) * 100) : 100

    // Group entities by category
    const groups = review?.groups || {}
    const entitiesByGroup: Record<string, ReviewEntity[]> = {}
    review?.entities?.forEach(e => {
        const g = e.group || 'other'
        if (!entitiesByGroup[g]) entitiesByGroup[g] = []
        entitiesByGroup[g].push(e)
    })
    const groupOrder = ['infrastructure', 'master_data', 'products', 'partners', 'finance', 'transactions', 'other']

    return (
        <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-500">
            {/*  Status Banner  */}
            <div className={`relative rounded-2xl overflow-hidden shadow-lg ${job.status === "COMPLETED" ? "bg-gradient-to-br from-emerald-50 via-white to-teal-50 border border-emerald-200/60"
                : (job.status === "FAILED" || job.status === "STALLED") ? "bg-gradient-to-br from-red-50 via-white to-orange-50 border border-red-200/60"
                    : "bg-gradient-to-br from-amber-50 via-white to-yellow-50 border border-amber-200/60"
                }`}>
                {/* Decorative top strip */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${job.status === "COMPLETED" ? "bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600"
                    : (job.status === "FAILED" || job.status === "STALLED") ? "bg-gradient-to-r from-red-400 via-orange-500 to-red-500"
                        : "bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500"
                    }`} />
                <div className="flex items-center gap-6 p-6 pt-7">
                    {job.status === "COMPLETED" ? (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0 border border-emerald-200/50 shadow-md shadow-emerald-200/30">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                        </div>
                    ) : job.status === "FAILED" ? (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center shrink-0 border border-red-200/50 shadow-md shadow-red-200/30">
                            <XCircle className="w-8 h-8 text-red-600" />
                        </div>
                    ) : job.status === "STALLED" ? (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center shrink-0 animate-pulse border border-orange-200/50 shadow-md">
                            <AlertTriangle className="w-8 h-8 text-orange-600" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center shrink-0 border border-amber-200/50 shadow-md">
                            <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                            Migration Review
                        </h2>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {job.source_business_name && (
                                <span className="text-orange-700 border border-orange-200 bg-orange-50 px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5">
                                    <Building2 className="w-3 h-3" />
                                    {job.source_business_name}
                                </span>
                            )}
                            {job?.completed_at && (
                                <span className="text-gray-400 text-xs font-medium">
                                    Completed {new Date(job.completed_at).toLocaleString()}
                                </span>
                            )}
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : job.status === 'FAILED' ? 'bg-red-100 text-red-700 border-red-200'
                                    : 'bg-amber-100 text-amber-700 border-amber-200'
                                }`}>{job.status}</span>
                        </div>
                    </div>
                    {/* Health Ring */}
                    {review && (
                        <div className="relative w-20 h-20 shrink-0">
                            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
                                <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(15, 23, 42, 0.06)" strokeWidth="5" />
                                <circle cx="36" cy="36" r="30" fill="none"
                                    stroke={healthPercent >= 95 ? '#059669' : healthPercent >= 70 ? '#d97706' : '#dc2626'}
                                    strokeWidth="5" strokeLinecap="round"
                                    strokeDasharray={`${healthPercent * 1.885} 188.5`}
                                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-xl font-black ${healthPercent >= 95 ? 'text-emerald-600' : healthPercent >= 70 ? 'text-amber-600' : 'text-red-600'
                                    }`}>{healthPercent}%</span>
                                <span className="text-gray-400 text-[7px] font-bold uppercase tracking-widest">Health</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/*  Summary Stats  */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total Imported", value: totalMappings, icon: Database, color: "text-blue-600", iconBg: "bg-blue-100", bg: "bg-white border-gray-200 hover:border-blue-300 hover:shadow-blue-100/50" },
                    { label: "Ready / Good", value: totalGood, icon: CheckCircle2, color: "text-emerald-600", iconBg: "bg-emerald-100", bg: "bg-white border-gray-200 hover:border-emerald-300 hover:shadow-emerald-100/50" },
                    { label: "Needs Review", value: totalDraft, icon: AlertTriangle, color: "text-amber-600", iconBg: "bg-amber-100", bg: "bg-white border-gray-200 hover:border-amber-300 hover:shadow-amber-100/50" },
                    { label: "Errors", value: totalErrors, icon: XCircle, color: totalErrors > 0 ? "text-red-600" : "text-gray-300", iconBg: totalErrors > 0 ? "bg-red-100" : "bg-gray-100", bg: totalErrors > 0 ? "bg-white border-gray-200 hover:border-red-300" : "bg-white border-gray-200" },
                ].map(({ label, value, icon: StatIcon, color, iconBg, bg }) => (
                    <div key={label} className={`border rounded-2xl p-4 transition-all shadow-sm hover:shadow-md ${bg}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                                <StatIcon className={`w-5 h-5 ${color}`} />
                            </div>
                            <div>
                                <p className={`${color} text-2xl font-black tracking-tight leading-none`}>{(value || 0).toLocaleString()}</p>
                                <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">{label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/*  Pipeline Tracker  */}
            <MigrationPipeline jobId={job.id} jobStatus={job.status} onResume={() => window.location.reload()} />

            {/*  Tab Switcher  */}
            <div className="flex gap-1 border-b border-gray-200 pb-0">
                {[
                    { key: "overview" as const, label: "Entity Overview", icon: Layers, badge: null },
                    { key: "errors" as const, label: "Errors", icon: AlertTriangle, badge: totalErrors > 0 ? totalErrors : null },
                ].map(tab => {
                    const TabIcon = tab.icon
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`px-5 py-2.5 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 border-b-2 ${activeTab === tab.key
                                ? "border-emerald-500 text-emerald-700 bg-emerald-50/50"
                                : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                }`}
                        >
                            <TabIcon className="w-4 h-4" />
                            {tab.label}
                            {tab.badge !== null && (
                                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center">{tab.badge}</span>
                            )}
                        </button>
                    )
                })}
                {/* Refresh */}
                <button onClick={fetchReview} className="ml-auto px-3 py-2 text-gray-300 hover:text-emerald-600 transition-all rounded-lg hover:bg-emerald-50" title="Refresh">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/*  Overview Tab  */}
            {activeTab === "overview" && (
                loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-purple-600 animate-spin mr-3" />
                        <span className="text-slate-500 font-medium">Loading review data...</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupOrder.filter(g => entitiesByGroup[g]?.length).map(groupKey => {
                            const groupEntities = entitiesByGroup[groupKey] || []
                            const groupLabel = groups[groupKey] || groupKey
                            const groupMeta = GROUP_ICONS[groupKey] || GROUP_ICONS.other
                            const GroupIcon = groupMeta.icon
                            const groupTotal = groupEntities.reduce((s, e) => s + e.total, 0)
                            const groupDraft = groupEntities.reduce((s, e) => s + e.draft, 0)
                            const isExpanded = expandedGroup === null || expandedGroup === groupKey

                            return (
                                <div key={groupKey} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    {/* Group Header */}
                                    <button
                                        onClick={() => setExpandedGroup(expandedGroup === groupKey ? null : groupKey)}
                                        className={`w-full flex items-center gap-4 p-4 transition-all hover:bg-gray-50/80 bg-gradient-to-r ${groupMeta.gradient}`}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-gray-200/80 shadow-sm">
                                            <GroupIcon className="w-5 h-5 text-gray-600" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <span className="text-gray-900 font-bold text-sm">{groupLabel}</span>
                                            <span className="text-gray-400 text-[11px] ml-2 font-medium">({groupEntities.length})</span>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-gray-900 font-mono text-sm font-black bg-gray-100 px-2.5 py-0.5 rounded-lg">{(groupTotal || 0).toLocaleString()}</span>
                                            {groupDraft > 0 && (
                                                <span className="text-[9px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                                                    {groupDraft} ⚠
                                                </span>
                                            )}
                                            <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                        </div>
                                    </button>

                                    {/* Group Content */}
                                    {isExpanded && (
                                        <div className="divide-y divide-white/5">
                                            {groupEntities.map(entity => {
                                                const Icon = ENTITY_ICONS[entity.entity_type] || Database
                                                const label = ENTITY_LABELS[entity.entity_type] || entity.entity_type
                                                const color = ENTITY_COLORS[entity.entity_type] || "text-slate-600"
                                                const pct = entity.total > 0 ? Math.round((entity.good / entity.total) * 100) : 100
                                                const hasDrafts = entity.draft > 0

                                                return (
                                                    <div
                                                        key={entity.entity_type}
                                                        onClick={() => fetchSamples(entity.entity_type)}
                                                        className={`flex items-center gap-4 px-5 py-3.5 transition-all cursor-pointer ${hasDrafts ? "bg-amber-50/50 hover:bg-amber-100/50" : "hover:bg-gray-50/50"
                                                            }`}>
                                                        {/* Icon */}
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${hasDrafts ? 'bg-amber-100 border border-amber-200' : 'bg-gray-100 border border-gray-200'
                                                            }`}>
                                                            <Icon className={`w-4 h-4 ${hasDrafts ? 'text-amber-600' : color.replace('text-cyan-600', 'text-cyan-600').replace('text-blue-600', 'text-blue-600').replace('text-indigo-600', 'text-indigo-600').replace('text-purple-600', 'text-purple-600').replace('text-pink-600', 'text-pink-600').replace('text-amber-600', 'text-amber-600').replace('text-orange-600', 'text-orange-600').replace('text-emerald-600', 'text-emerald-600').replace('text-teal-400', 'text-teal-600').replace('text-sky-400', 'text-sky-600').replace('text-lime-400', 'text-lime-600').replace('text-rose-400', 'text-rose-600').replace('text-violet-400', 'text-violet-600').replace('text-fuchsia-400', 'text-fuchsia-600')}`} />
                                                        </div>

                                                        {/* Label + Progress */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-gray-900 font-bold text-[13px]">{label}</span>
                                                                {hasDrafts && (
                                                                    <span className="text-[8px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full border border-amber-200">
                                                                        {entity.draft} draft
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-700 ${pct >= 95 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
                                                                        }`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Count */}
                                                        <div className="text-right shrink-0 min-w-[70px]">
                                                            <span className="text-gray-950 font-mono text-sm font-black">{(entity.total || 0).toLocaleString()}</span>
                                                            <p className="text-gray-400 text-[9px] font-bold">
                                                                {(entity.good || 0).toLocaleString()} ok{hasDrafts ? ` · ${entity.draft || 0} ⚠` : ''}
                                                            </p>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {entity.can_approve && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleBulkApprove(entity.entity_type) }}
                                                                    disabled={approving === entity.entity_type}
                                                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-all disabled:opacity-50 flex items-center gap-1"
                                                                >
                                                                    {approving === entity.entity_type ? (
                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                    ) : (
                                                                        <CheckCircle2 className="w-3 h-3" />
                                                                    )}
                                                                    Approve All
                                                                </button>
                                                            )}
                                                            {entity.entity_type === 'ACCOUNT' && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); fetchAccountMappingData() }}
                                                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-all flex items-center gap-1"
                                                                >
                                                                    <Banknote className="w-3 h-3" />
                                                                    Map COA
                                                                </button>
                                                            )}
                                                            <button
                                                                className="px-2 py-1 rounded-md text-[10px] bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition-all font-bold uppercase tracking-tight"
                                                                onClick={(e) => { e.stopPropagation(); fetchSamples(entity.entity_type) }}
                                                            >
                                                                Audit Info
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const url = entity.filter_param && hasDrafts
                                                                        ? `${entity.page_link}?${entity.filter_param}`
                                                                        : entity.page_link!
                                                                    window.open(url, '_blank')
                                                                }}
                                                                className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all outline-none focus:ring-1 focus:ring-emerald-500/50"
                                                                title={`Open ${label}`}
                                                            >
                                                                <ArrowRight className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )
            )}

            {/*  Errors Tab  */}
            {activeTab === "errors" && (
                <div className="space-y-4">
                    {/* Needs Review Banner */}
                    {(review?.needs_review_count || 0) > 0 && (
                        <Card className="bg-amber-500/5 border-amber-200 overflow-hidden">
                            <CardContent className="flex items-center gap-4 py-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-amber-600 font-bold text-sm">
                                        {review?.needs_review_count} records tagged [NEEDS REVIEW]
                                    </p>
                                    <p className="text-amber-600/50 text-xs mt-0.5">
                                        These records were imported as DRAFT because they were missing required fields. Review them in each entity page.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Error Lines */}
                    <Card className="bg-white border-slate-200 backdrop-blur-xl overflow-hidden">
                        <CardHeader className="pb-2 border-b border-slate-100 relative">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-500 to-orange-500" />
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-red-400/80 flex items-center gap-2 mt-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Error Log ({review?.total_errors || 0} entries)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3">
                            {review?.error_lines_preview?.length ? (
                                <div className="space-y-1">
                                    {(showAllErrors ? review.error_lines_preview : review.error_lines_preview.slice(0, 15)).map((line, i) => (
                                        <div key={i} className="flex gap-2 text-[11px] font-mono leading-relaxed py-1 px-2 rounded hover:bg-slate-100">
                                            <span className="text-white/15 shrink-0 w-6 text-right select-none">{i + 1}</span>
                                            <span className={`${line.includes('ERROR') || line.includes('error') ? 'text-red-400'
                                                : line.includes('WARN') || line.includes('skip') ? 'text-amber-600'
                                                    : 'text-slate-500'
                                                }`}>
                                                {line}
                                            </span>
                                        </div>
                                    ))}
                                    {review.error_lines_preview.length > 15 && !showAllErrors && (
                                        <button
                                            onClick={() => setShowAllErrors(true)}
                                            className="text-xs text-purple-600 hover:text-purple-300 font-semibold mt-2 transition-all"
                                        >
                                            Show all {review.error_lines_preview.length} errors →
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-10">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                                    <p className="text-slate-400 text-sm">No errors recorded for this migration.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/*  Audit Modal  */}
            <Dialog open={!!auditEntity} onOpenChange={(open) => !open && setAuditEntity(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] bg-white border-gray-200 shadow-2xl text-gray-900 overflow-hidden flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                        <DialogTitle className="flex items-center gap-2.5 text-xl font-black text-gray-900">
                            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-purple-600" />
                            </div>
                            Wizard: Verify 3 Examples of {auditEntity ? (ENTITY_LABELS[auditEntity] || auditEntity) : ''}
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 mt-1 font-medium">
                            Please audit these exactly 3 examples to verify the data was transformed correctly before approving.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden flex flex-col min-h-0 mt-4">
                        <ScrollArea className="flex-1 px-6">
                            {loadingSamples ? (
                                <div className="py-20 flex flex-col items-center justify-center gap-4 text-white/20">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                    <p className="text-sm font-medium">Fetching detailed samples...</p>
                                </div>
                            ) : (
                                <div className="space-y-6 pb-8">
                                    {/* Logic Section */}
                                    <div className="bg-purple-50 border border-purple-200/60 rounded-xl p-4">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-purple-600 mb-2">Integration Logic</h4>
                                        <p className="text-sm leading-relaxed text-purple-700/70 italic">
                                            "{auditSamples?.[0]?.integration_logic || "Standard field-to-field mapping with organization scope enforcement."}"
                                        </p>
                                    </div>

                                    {/* Samples List */}
                                    <div className="space-y-4">
                                        {auditSamples?.map((sample, idx) => (
                                            <div key={idx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                                                <div className="bg-purple-50 px-4 py-3 border-b border-purple-100 flex items-center justify-between">
                                                    <span className="text-xs font-bold text-purple-900 uppercase tracking-widest">Example {idx + 1}</span>
                                                    <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-600 bg-white shadow-sm">ID: {sample.target_id}</Badge>
                                                </div>

                                                <div className="p-5 flex-1 space-y-4">
                                                    {/* Clean Audit Fields extracted from target state */}
                                                    {auditEntity === 'TRANSACTION' && sample.target_state && (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Status</span>
                                                                <p className="text-xs font-black text-amber-600">{sample.target_state.status}</p>
                                                            </div>
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Amount</span>
                                                                <p className="text-xs font-black text-slate-900">{(sample.target_state.total_ttc || sample.target_state.amount || 0).toLocaleString()}</p>
                                                            </div>
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Type</span>
                                                                <p className="text-xs font-black text-purple-600 uppercase">{sample.target_state.type}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {auditEntity === 'EXPENSE' && sample.target_state && (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Category</span>
                                                                <p className="text-xs font-black text-purple-600">{sample.target_state.category}</p>
                                                            </div>
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Target Amount</span>
                                                                <p className="text-xs font-black text-slate-900">{(sample.target_state.amount || 0).toLocaleString()}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {auditEntity === 'PRODUCT' && sample.target_state && (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">SKU</span>
                                                                <p className="text-xs font-black text-blue-600">{sample.target_state.sku}</p>
                                                            </div>
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Type</span>
                                                                <p className="text-xs font-black text-slate-900">{sample.target_state.product_type}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {auditEntity === 'CONTACT' && sample.target_state && (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Name</span>
                                                                <p className="text-xs font-black text-indigo-600">{sample.target_state.name}</p>
                                                            </div>
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Role</span>
                                                                <p className="text-xs font-black text-slate-900">{sample.target_state.type}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {auditEntity === 'JOURNAL_ENTRY' && sample.target_state && (
                                                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                                                            <span className="text-[9px] text-emerald-600/60 font-bold uppercase tracking-wider block mb-1">Accounting Verification</span>
                                                            <p className="text-xs font-black text-emerald-700 mt-1 leading-tight">
                                                                Verified double-entry structure.
                                                            </p>
                                                        </div>
                                                    )}
                                                    {auditEntity === 'STOCK_ADJUSTMENT' && sample.target_state && (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Ref</span>
                                                                <p className="text-xs font-black text-red-500">{sample.target_state.reference}</p>
                                                            </div>
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Qty Adj</span>
                                                                <p className="text-xs font-black text-slate-900">{sample.target_state.total_qty_adjustment}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {auditEntity === 'STOCK_TRANSFER' && sample.target_state && (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Ref</span>
                                                                <p className="text-xs font-black text-orange-500">{sample.target_state.reference}</p>
                                                            </div>
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Warehouse</span>
                                                                <p className="text-xs font-black text-slate-900 truncate" title={`${sample.target_state.from_warehouse_name} → ${sample.target_state.to_warehouse_name}`}>
                                                                    {sample.target_state.from_warehouse_name} {"→"} {sample.target_state.to_warehouse_name}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <details className="mt-4 pt-4 border-t border-gray-100 cursor-pointer group">
                                                        <summary className="text-[10px] font-bold uppercase tracking-wider text-gray-400 group-hover:text-purple-600 transition-colors list-none flex items-center gap-1.5 focus:outline-none">
                                                            <FileJson className="w-3 h-3" />
                                                            Developer Data (Raw JSON)
                                                        </summary>
                                                        <div className="mt-3 cursor-auto grid grid-cols-2 gap-4">
                                                            <div className="space-y-1">
                                                                <span className="text-[9px] font-bold uppercase text-gray-400">UPOS Source (Raw)</span>
                                                                <pre className="text-[9px] font-mono leading-tight bg-slate-900 p-2.5 rounded text-amber-200/90 max-h-40 overflow-y-auto">
                                                                    {JSON.stringify(sample.source_raw, null, 2)}
                                                                </pre>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <span className="text-[9px] font-bold uppercase text-gray-400">TSF Target (State)</span>
                                                                <pre className="text-[9px] font-mono leading-tight bg-emerald-950 p-2.5 rounded text-emerald-300 max-h-40 overflow-y-auto w-full overflow-x-auto">
                                                                    {JSON.stringify(sample.target_state, null, 2)}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </details>
                                                </div>
                                            </div>

                                        ))}
                                    </div>
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center rounded-b-lg">
                        <Button variant="ghost" className="text-gray-400 hover:text-gray-700 font-bold" onClick={() => setAuditEntity(null)}>
                            Close
                        </Button>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="border-gray-200 text-gray-600 hover:bg-gray-100 text-xs font-bold"
                                onClick={() => {
                                    const entityData = review?.entities.find(e => e.entity_type === auditEntity)
                                    if (entityData?.page_link) window.open(entityData.page_link, '_blank')
                                }}
                            >
                                <Eye className="w-3.5 h-3.5 mr-2" /> Open Full List
                            </Button>
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 rounded-xl px-6"
                                onClick={() => {
                                    if (auditEntity) {
                                        handleBulkApprove(auditEntity)
                                        setAuditEntity(null)
                                    }
                                }}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Approve All {auditEntity ? (ENTITY_LABELS[auditEntity] || auditEntity) : ''}
                            </Button>
                        </div>
                    </div>
                </DialogContent >
            </Dialog >

            <COAMappingModal
                open={showAccountMapping}
                onOpenChange={setShowAccountMapping}
                data={mappingData}
                onSave={handleSaveAccountMapping}
                loading={savingMapping}
            />
        </div >
    )
}
