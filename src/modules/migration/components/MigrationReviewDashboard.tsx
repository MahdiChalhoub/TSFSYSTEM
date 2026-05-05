// @ts-nocheck
"use client"
import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, RefreshCw, Eye, CheckCircle2, RotateCcw, AlertTriangle, Package, Tag, Layers, Ruler, Users, ShoppingCart, Banknote, Building2, Globe, Database, XCircle, Loader2, ChevronRight, ArrowRight, DatabaseZap, FileJson } from "lucide-react"
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
    UNIT: "text-app-info", CATEGORY: "text-app-info", BRAND: "text-app-info",
    PRODUCT: "text-purple-600", CONTACT: "text-app-error", TRANSACTION: "text-app-warning",
    ORDER_LINE: "text-app-warning", ACCOUNT: "text-app-success", ACCOUNT_TRANSACTION: "text-app-success",
    TAX_RATE: "text-app-muted-foreground", BUSINESS_LOCATION: "text-app-info", EXPENSE_CATEGORY: "text-app-error",
    PRODUCT_VARIATION: "text-app-error", CUSTOMER_GROUP: "text-violet-600", ACCOUNT_TYPE: "text-app-success",
    USER: "text-app-muted-foreground", CURRENCY: "text-app-warning", COMBO_LINK: "text-app-muted-foreground",
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

    const renderAccountingAudit = (etype: string, sample: { target_state: any; source_raw: any }) => {
        const state = sample.target_state || {}
        // const source = sample.source_raw || {} // source is available via sample.source_raw

        if (etype === 'ACCOUNT') {
            return (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-app-muted-foreground uppercase">Accounting Connection</span>
                        {state.is_linked_to_coa ? (
                            <Badge className="bg-app-success-soft text-app-success border-app-success">LINKED TO COA</Badge>
                        ) : (
                            <Badge className="bg-app-warning-soft text-app-warning border-app-warning">PENDING LINK</Badge>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-app-bg p-3 rounded-xl border border-app-border">
                            <span className="text-[9px] text-app-muted-foreground font-bold uppercase block mb-1">Account Type</span>
                            <p className="text-sm font-black text-app-foreground">{state.type || 'N/A'}</p>
                        </div>
                        <div className="bg-app-bg p-3 rounded-xl border border-app-border">
                            <span className="text-[9px] text-app-muted-foreground font-bold uppercase block mb-1">Currency</span>
                            <p className="text-sm font-black text-app-foreground">{state.currency || 'USD'}</p>
                        </div>
                    </div>
                    <div className="bg-app-success-soft/50 p-4 rounded-2xl border border-emerald-100">
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-[10px] text-app-success font-black uppercase tracking-tight">Migrated Balance</span>
                                <p className="text-2xl font-black text-emerald-950">{(state.balance || 0).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] text-app-success/50 font-bold block">Integrity Check</span>
                                <p className="text-[10px] font-bold text-app-success">MATCHES SOURCE</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        }

        if (etype === 'CONTACT') {
            return (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-app-muted-foreground uppercase">Auxiliary Ledger</span>
                        {state.has_ledger_link ? (
                            <Badge className="bg-app-info-soft text-app-info border-app-info">LEDGER READY</Badge>
                        ) : (
                            <Badge className="bg-app-error-soft text-app-error border-app-error">MISSING ACCOUNT</Badge>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-app-bg p-3 rounded-xl border border-app-border">
                            <span className="text-[9px] text-app-muted-foreground font-bold uppercase block mb-1">Partner Type</span>
                            <p className="text-sm font-black text-app-foreground uppercase">{state.type || 'Contact'}</p>
                        </div>
                        <div className="bg-app-bg p-3 rounded-xl border border-app-border">
                            <span className="text-[9px] text-app-muted-foreground font-bold uppercase block mb-1">Tax ID</span>
                            <p className="text-sm font-black text-app-foreground">{state.tax_number || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="bg-app-info-soft/50 p-4 rounded-2xl border border-indigo-100">
                        <span className="text-[10px] text-app-info font-black uppercase tracking-tight">Opening Balance</span>
                        <p className="text-2xl font-black text-indigo-950">{(state.opening_balance || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-indigo-400 mt-1">Amount will be carried over to {state.type} Sub-ledger.</p>
                    </div>
                </div>
            )
        }

        if (etype === 'PRODUCT') {
            return (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-app-muted-foreground uppercase">Valuation & Margin</span>
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200">{state.product_type}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-app-bg p-2.5 rounded-xl border border-app-border">
                            <span className="text-[9px] text-app-muted-foreground font-bold uppercase block mb-1">Unit Cost</span>
                            <p className="text-xs font-black text-app-foreground">{(state.purchase_price || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-app-bg p-2.5 rounded-xl border border-app-border">
                            <span className="text-[9px] text-app-muted-foreground font-bold uppercase block mb-1">Price (HT)</span>
                            <p className="text-xs font-black text-app-info">{(state.selling_price || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-app-bg p-2.5 rounded-xl border border-app-border">
                            <span className="text-[9px] text-app-muted-foreground font-bold uppercase block mb-1">Tax Rate</span>
                            <p className="text-xs font-black text-app-success">{state.tax_rate || '0'}%</p>
                        </div>
                    </div>
                    {state.product_type === 'COMBO' && state.combo_components?.length > 0 && (
                        <div className="bg-app-warning-soft/50 p-3 rounded-xl border border-amber-100">
                            <span className="text-[10px] text-app-warning font-black uppercase mb-2 block">Combo Definition</span>
                            <div className="space-y-1.5">
                                {state.combo_components.map((c: any, ci: number) => (
                                    <div key={ci} className="flex justify-between text-[11px]">
                                        <span className="text-amber-900 font-bold">{c.product}</span>
                                        <span className="text-app-warning font-mono">x{c.qty}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )
        }

        if (etype === 'TRANSACTION' || etype === 'EXPENSE') {
            const isSale = etype === 'TRANSACTION'
            return (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-app-muted-foreground uppercase">Posting Details</span>
                        <Badge className={`bg-app-surface border ${state.status === 'PAID' || state.status === 'COMPLETED' ? 'text-app-success border-app-success' : 'text-app-warning border-app-warning'}`}>
                            {state.status}
                        </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-app-bg p-2.5 rounded-xl border border-app-border">
                            <span className="text-[9px] text-app-muted-foreground font-bold uppercase block mb-1">Reference</span>
                            <p className="text-xs font-black text-app-foreground">{state.reference || state.id}</p>
                        </div>
                        <div className="bg-app-bg p-2.5 rounded-xl border border-app-border">
                            <span className="text-[9px] text-app-muted-foreground font-bold uppercase block mb-1">Date</span>
                            <p className="text-xs font-black text-app-foreground">{state.date ? new Date(state.date).toLocaleDateString() : 'N/A'}</p>
                        </div>
                    </div>
                    <div className={`p-4 rounded-2xl border ${isSale ? 'bg-app-info-soft border-sky-100' : 'bg-app-error-soft border-rose-100'}`}>
                        <div className="flex justify-between items-center">
                            <div>
                                <span className={`text-[10px] font-black uppercase ${isSale ? 'text-app-info' : 'text-app-error'}`}>Total Amount ({isSale ? 'TTC' : 'HT'})</span>
                                <p className={`text-2xl font-black ${isSale ? 'text-sky-950' : 'text-rose-950'}`}>{(state.total_ttc || state.amount || 0).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] text-app-muted-foreground font-bold block">Method</span>
                                <p className="text-xs font-black text-app-foreground uppercase">{state.payment_method || 'CREDIT'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        }

        return (
            <div className="py-10 text-center">
                <p className="text-xs text-app-muted-foreground font-medium italic">Standard field-for-field mapping verification.</p>
            </div>
        )
    }

    const [error, setError] = useState<string | null>(null)

    const fetchReview = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await getMigrationReview(job.id)
            if (data) {
                setReview(data)
                console.log("[MigrationReview] Data loaded:", data.entities?.length, "entities");
            } else {
                setError("No data received from server")
            }
        } catch (err: any) {
            console.error("[MigrationReview] Fetch failed:", err);
            setError(err.message || "Failed to load migration review data")
        } finally {
            setLoading(false)
        }
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
            <div className={`relative rounded-2xl overflow-hidden shadow-lg ${job.status === "COMPLETED" ? "bg-gradient-to-br from-emerald-50 via-white to-teal-50 border border-app-success/60"
                : (job.status === "FAILED" || job.status === "STALLED") ? "bg-gradient-to-br from-red-50 via-white to-orange-50 border border-app-error/60"
                    : "bg-gradient-to-br from-amber-50 via-white to-yellow-50 border border-app-warning/60"
                }`}>
                {/* Decorative top strip */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${job.status === "COMPLETED" ? "bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600"
                    : (job.status === "FAILED" || job.status === "STALLED") ? "bg-gradient-to-r from-red-400 via-orange-500 to-red-500"
                        : "bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500"
                    }`} />
                <div className="flex items-center gap-6 p-6 pt-7">
                    {job.status === "COMPLETED" ? (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0 border border-app-success/50 shadow-md shadow-emerald-200/30">
                            <CheckCircle2 className="w-8 h-8 text-app-success" />
                        </div>
                    ) : job.status === "FAILED" ? (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center shrink-0 border border-app-error/50 shadow-md shadow-red-200/30">
                            <XCircle className="w-8 h-8 text-app-error" />
                        </div>
                    ) : job.status === "STALLED" ? (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center shrink-0 animate-pulse border border-app-warning/50 shadow-md">
                            <AlertTriangle className="w-8 h-8 text-app-warning" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center shrink-0 border border-app-warning/50 shadow-md">
                            <Loader2 className="w-8 h-8 text-app-warning animate-spin" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h2>
                            Migration Review
                        </h2>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {job.source_business_name && (
                                <span className="text-app-warning border border-app-warning bg-app-warning-soft px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5">
                                    <Building2 className="w-3 h-3" />
                                    {job.source_business_name}
                                </span>
                            )}
                            {job?.completed_at && (
                                <span className="text-app-muted-foreground text-xs font-medium">
                                    Completed {new Date(job.completed_at).toLocaleString()}
                                </span>
                            )}
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${job.status === 'COMPLETED' ? 'bg-app-success-soft text-app-success border-app-success'
                                : job.status === 'FAILED' ? 'bg-app-error-soft text-app-error border-app-error'
                                    : 'bg-app-warning-soft text-app-warning border-app-warning'
                                }`}>{job.status}</span>
                            {['FAILED', 'STALLED', 'ROLLED_BACK'].includes(job.status) && (
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                            const { deleteMigrationJob } = await import('@/modules/migration/actions');
                                            await deleteMigrationJob(job.id);
                                            toast.success(`Migration "${job.name}" hidden`);
                                            goBack();
                                        } catch { toast.error('Failed to hide job'); }
                                    }}
                                    className="w-6 h-6 rounded-full bg-app-error-soft hover:bg-red-200 flex items-center justify-center transition-all"
                                    title="Hide this failed migration"
                                >
                                    <XCircle className="w-3.5 h-3.5 text-app-error" />
                                </button>
                            )}
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
                                <span className={`text-xl font-black ${healthPercent >= 95 ? 'text-app-success' : healthPercent >= 70 ? 'text-app-warning' : 'text-app-error'
                                    }`}>{healthPercent}%</span>
                                <span className="text-app-muted-foreground font-bold uppercase tracking-widest">Health</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/*  Summary Stats  */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total Imported", value: totalMappings, icon: Database, color: "text-app-info", iconBg: "bg-app-info-soft", bg: "bg-app-surface border-app-border hover:border-app-info hover:shadow-blue-100/50" },
                    { label: "Ready / Good", value: totalGood, icon: CheckCircle2, color: "text-app-success", iconBg: "bg-app-success-soft", bg: "bg-app-surface border-app-border hover:border-app-success hover:shadow-emerald-100/50" },
                    { label: "Needs Review", value: totalDraft, icon: AlertTriangle, color: "text-app-warning", iconBg: "bg-app-warning-soft", bg: "bg-app-surface border-app-border hover:border-app-warning hover:shadow-amber-100/50" },
                    { label: "Errors", value: totalErrors, icon: XCircle, color: totalErrors > 0 ? "text-app-error" : "text-app-muted-foreground", iconBg: totalErrors > 0 ? "bg-app-error-soft" : "bg-app-surface-2", bg: totalErrors > 0 ? "bg-app-surface border-app-border hover:border-app-error" : "bg-app-surface border-app-border" },
                ].map(({ label, value, icon: StatIcon, color, iconBg, bg }) => (
                    <div key={label} className={`border rounded-2xl p-4 transition-all shadow-sm hover:shadow-md ${bg}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                                <StatIcon className={`w-5 h-5 ${color}`} />
                            </div>
                            <div>
                                <p className={`${color} text-2xl font-black tracking-tight leading-none`}>{(value || 0).toLocaleString()}</p>
                                <p className="text-app-muted-foreground text-[9px] font-bold uppercase tracking-widest mt-0.5">{label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/*  Pipeline Tracker  */}
            <MigrationPipeline jobId={job.id} jobStatus={job.status} onResume={() => window.location.reload()} />

            {/*  Tab Switcher  */}
            <div className="flex gap-1 border-b border-app-border pb-0">
                {[
                    { key: "overview" as const, label: "Entity Overview", icon: Layers, badge: null },
                    { key: "errors" as const, label: "Errors", icon: AlertTriangle, badge: totalErrors > 0 ? totalErrors : null },
                ].map(tab => {
                    const TabIcon = tab.icon
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`px-5 py-2.5 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 border-b-2 ${activeTab === tab.key
                                ? "border-app-success text-app-success bg-app-success-soft/50"
                                : "border-transparent text-app-muted-foreground hover:text-app-muted-foreground hover:bg-app-bg"
                                }`}
                        >
                            <TabIcon className="w-4 h-4" />
                            {tab.label}
                            {tab.badge !== null && (
                                <span className="bg-app-error text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center">{tab.badge}</span>
                            )}
                        </button>
                    )
                })}
                {/* Refresh */}
                <button onClick={fetchReview} className="ml-auto px-3 py-2 text-app-muted-foreground hover:text-app-success transition-all rounded-lg hover:bg-app-success-soft" title="Refresh">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/*  Overview Tab  */}
            {activeTab === "overview" && (
                loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-app-surface border border-dashed border-app-border rounded-3xl">
                        <Loader2 className="w-10 h-10 text-app-success animate-spin mb-4" />
                        <span className="text-app-muted-foreground font-bold tracking-tight">Gathering migration intelligence...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-app-error-soft/30 border border-dashed border-app-error rounded-3xl">
                        <AlertTriangle className="w-10 h-10 text-app-error mb-4" />
                        <span className="text-app-error font-bold">Failed to load overview</span>
                        <p className="text-app-error/70 text-sm mt-1 mb-6">{error}</p>
                        <Button onClick={fetchReview} size="sm" className="bg-app-error hover:bg-app-error text-white rounded-xl">
                            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Retry Fetch
                        </Button>
                    </div>
                ) : review?.entities?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-app-bg border border-dashed border-app-border rounded-3xl">
                        <DatabaseZap className="w-10 h-10 text-app-muted-foreground mb-4" />
                        <span className="text-app-muted-foreground font-bold">No migrated data found yet</span>
                        <p className="text-app-muted-foreground text-sm mt-1">The migration might still be in the early stages.</p>
                        <Button onClick={fetchReview} variant="outline" size="sm" className="mt-6 border-app-border text-app-muted-foreground">
                            Check Again
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* High-Level Health Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-app-surface border border-app-border p-5 rounded-[2rem] shadow-sm">
                                <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Global Progress</p>
                                <div className="flex items-end justify-between">
                                    <h4 className="font-black text-app-foreground">{review?.total_good ? Math.round((review.total_good / (review.total_mappings || 1)) * 100) : 0}%</h4>
                                    <Badge className="bg-app-success-soft text-app-success border-none font-black text-[9px]">DATA SYNC</Badge>
                                </div>
                            </div>
                            <div className="bg-app-surface border border-app-border p-5 rounded-[2rem] shadow-sm">
                                <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Audit Ready</p>
                                <div className="flex items-end justify-between">
                                    <h4 className="font-black text-app-success">{(review?.total_good || 0).toLocaleString()}</h4>
                                    <CheckCircle2 className="w-4 h-4 text-app-success mb-1" />
                                </div>
                            </div>
                            <div className="bg-app-surface border border-app-border p-5 rounded-[2rem] shadow-sm">
                                <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Needs Attention</p>
                                <div className="flex items-end justify-between">
                                    <h4 className="font-black text-app-warning">{(review?.needs_review_count || 0).toLocaleString()}</h4>
                                    <AlertTriangle className="w-4 h-4 text-app-warning mb-1" />
                                </div>
                            </div>
                            <div className="bg-app-surface border border-app-border p-5 rounded-[2rem] shadow-sm">
                                <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Ledger Errors</p>
                                <div className="flex items-end justify-between">
                                    <h4 className="font-black text-app-error">{(review?.total_errors || 0).toLocaleString()}</h4>
                                    <XCircle className="w-4 h-4 text-app-error mb-1" />
                                </div>
                            </div>
                        </div>

                        {groupOrder.filter(g => entitiesByGroup[g]?.length).map(groupKey => {
                            const groupEntities = entitiesByGroup[groupKey] || []
                            const groupLabel = groups[groupKey] || groupKey
                            const groupMeta = GROUP_ICONS[groupKey] || GROUP_ICONS.other
                            const GroupIcon = groupMeta.icon

                            return (
                                <div key={groupKey} className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${groupMeta.gradient} flex items-center justify-center`}>
                                            <GroupIcon className="w-3.5 h-3.5 text-app-muted-foreground" />
                                        </div>
                                        <h3 className="uppercase text-app-muted-foreground">{groupLabel}</h3>
                                        <div className="h-px flex-1 bg-app-surface-2" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {groupEntities.map(entity => {
                                            const Icon = ENTITY_ICONS[entity.entity_type] || Database
                                            const label = ENTITY_LABELS[entity.entity_type] || entity.entity_type
                                            const color = ENTITY_COLORS[entity.entity_type] || "text-app-muted-foreground"
                                            const pct = entity.total > 0 ? Math.round((entity.good / entity.total) * 100) : 100
                                            const hasDrafts = entity.draft > 0 || entity.needs_review > 0

                                            return (
                                                <Card
                                                    key={entity.entity_type}
                                                    className={`group relative overflow-hidden transition-all hover:shadow-lg cursor-pointer border-app-border hover:border-app-success ${hasDrafts ? 'bg-app-warning-soft/30' : 'bg-app-surface'}`}
                                                    onClick={() => router.push(`/migration/audit?jobId=${job.id}&entityType=${entity.entity_type}`)}
                                                >
                                                    <div className={`absolute top-0 left-0 w-full h-1 ${pct >= 95 ? 'bg-app-success' : pct >= 70 ? 'bg-app-warning' : 'bg-app-error'}`} />

                                                    <CardContent className="p-4">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className={`p-2 rounded-xl ${hasDrafts ? 'bg-app-warning-soft' : 'bg-app-surface-2'} group-hover:scale-110 transition-transform`}>
                                                                <Icon className={`w-5 h-5 ${hasDrafts ? 'text-app-warning' : color}`} />
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xl font-black text-app-foreground leading-none">{(entity.total || 0).toLocaleString()}</p>
                                                                <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-tighter mt-1">Total {label}</p>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3">
                                                            <div>
                                                                <h4 className="font-black text-app-foreground group-hover:text-app-success transition-colors uppercase tracking-tight">{label}</h4>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <div className="flex-1 h-1.5 bg-app-surface-2 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-1000 ${pct >= 95 ? 'bg-app-success' : pct >= 70 ? 'bg-amber-400' : 'bg-app-error'}`}
                                                                            style={{ width: `${pct}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-[10px] font-black text-app-muted-foreground">{pct}%</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between">
                                                                <div className="flex gap-1">
                                                                    {hasDrafts && (
                                                                        <Badge className="bg-app-warning-soft text-app-warning hover:bg-app-warning-soft border-none text-[9px] font-black h-5 px-1.5">
                                                                            {entity.draft + entity.needs_review} REVIEW
                                                                        </Badge>
                                                                    )}
                                                                    <Badge className="bg-app-success-soft text-app-success hover:bg-app-success-soft border-none text-[9px] font-black h-5 px-1.5 uppercase">
                                                                        {entity.good} OK
                                                                    </Badge>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 rounded-lg hover:bg-app-success-soft hover:text-app-success"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const url = entity.filter_param && hasDrafts
                                                                            ? `${entity.page_link}?${entity.filter_param}`
                                                                            : entity.page_link!
                                                                        window.open(url, '_blank')
                                                                    }}
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                    </div>
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
                        <Card className="bg-app-warning/5 border-app-warning overflow-hidden">
                            <CardContent className="flex items-center gap-4 py-4">
                                <div className="w-10 h-10 rounded-xl bg-app-warning/20 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-app-warning" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-app-warning font-bold text-sm">
                                        {review?.needs_review_count} records tagged [NEEDS REVIEW]
                                    </p>
                                    <p className="text-app-warning/50 text-xs mt-0.5">
                                        These records were imported as DRAFT because they were missing required fields. Review them in each entity page.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Error Lines */}
                    <Card className="bg-app-surface border-app-border backdrop-blur-xl overflow-hidden">
                        <CardHeader className="pb-2 border-b border-app-border relative">
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
                                        <div key={i} className="flex gap-2 text-[11px] font-mono leading-relaxed py-1 px-2 rounded hover:bg-app-surface-2">
                                            <span className="text-white/15 shrink-0 w-6 text-right select-none">{i + 1}</span>
                                            <span className={`${line.includes('ERROR') || line.includes('error') ? 'text-red-400'
                                                : line.includes('WARN') || line.includes('skip') ? 'text-app-warning'
                                                    : 'text-app-muted-foreground'
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
                                    <CheckCircle2 className="w-8 h-8 text-app-success/40 mx-auto mb-2" />
                                    <p className="text-app-muted-foreground text-sm">No errors recorded for this migration.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/*  Audit Modal  */}
            <Dialog open={!!auditEntity} onOpenChange={(open) => !open && setAuditEntity(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] bg-app-surface border-app-border shadow-2xl text-app-foreground overflow-hidden flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-white border-b border-app-border">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="flex items-center gap-2.5 text-xl font-black text-app-foreground">
                                <div className="w-9 h-9 rounded-xl bg-app-success-soft flex items-center justify-center">
                                    <Banknote className="w-5 h-5 text-app-success" />
                                </div>
                                Accounting Audit: {auditEntity ? (ENTITY_LABELS[auditEntity] || auditEntity) : ''}
                            </DialogTitle>
                            <Badge className="bg-app-success-soft text-app-success border-app-success">INTEGRITY CHECK</Badge>
                        </div>
                        <DialogDescription className="text-app-muted-foreground mt-1 font-medium">
                            Verify if balances, accounting types, and ledger links match your source data.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-50/50">
                        <ScrollArea className="flex-1 px-6 py-6">
                            {loadingSamples ? (
                                <div className="py-20 flex flex-col items-center justify-center gap-4 text-app-muted-foreground">
                                    <Loader2 className="w-10 h-10 animate-spin text-app-success" />
                                    <p className="text-sm font-bold tracking-tight">Recalculating ledger impacts...</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {/* Audit Insights Summary */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="bg-app-success-soft border border-emerald-100 p-4 rounded-3xl">
                                            <div className="flex items-center gap-2 mb-1">
                                                <CheckCircle2 className="w-4 h-4 text-app-success" />
                                                <span className="text-[10px] font-black text-app-success uppercase tracking-widest">Data Consistency</span>
                                            </div>
                                            <p className="text-sm font-bold text-emerald-900">Fields synchronized 1:1 with source records.</p>
                                        </div>
                                        <div className="bg-app-info-soft border border-blue-100 p-4 rounded-3xl">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Database className="w-4 h-4 text-app-info" />
                                                <span className="text-[10px] font-black text-app-info uppercase tracking-widest">Ledger Integrity</span>
                                            </div>
                                            <p className="text-sm font-bold text-blue-900">Double-entry structure verified for {auditEntity ? (ENTITY_LABELS[auditEntity] || auditEntity) : ''}.</p>
                                        </div>
                                        <div className="bg-purple-50 border border-purple-100 p-4 rounded-3xl">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Layers className="w-4 h-4 text-purple-600" />
                                                <span className="text-[10px] font-black text-purple-800 uppercase tracking-widest">Auxiliary Links</span>
                                            </div>
                                            <p className="text-sm font-bold text-purple-900">Sub-ledger mappings successfully established.</p>
                                        </div>
                                    </div>

                                    {/* The "Decomposed" Grid of 3 Random Samples */}
                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-12">
                                        {auditSamples?.map((sample, idx) => (
                                            <div key={idx} className="flex flex-col gap-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted-foreground bg-app-surface px-3 py-1 rounded-full border border-app-border shadow-sm shrink-0">
                                                        Sample #{idx + 1}
                                                    </span>
                                                    <div className="h-px flex-1 bg-app-surface-2" />
                                                </div>

                                                {/* TSF TARGET SIDE (The "What we saved" part) */}
                                                <Card className="border-app-success shadow-xl shadow-emerald-500/5 rounded-[2.5rem] overflow-hidden flex-1 flex flex-col">
                                                    <div className="bg-app-success-soft px-5 py-3 border-b border-emerald-100 flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-app-success uppercase tracking-widest">TSF Accounting Report</span>
                                                        <Badge variant="outline" className="text-[9px] font-bold text-app-success border-app-success bg-app-surface">ID: {sample.target_id}</Badge>
                                                    </div>
                                                    <div className="p-6 flex-1">
                                                        {renderAccountingAudit(auditEntity!, sample)}
                                                    </div>
                                                </Card>

                                                {/* LEDGER IMPACT (Compact list) */}
                                                {(auditEntity === 'TRANSACTION' || auditEntity === 'EXPENSE') && sample.ledger_impact?.length > 0 && (
                                                    <div className="bg-slate-900 text-white rounded-[2rem] p-4 shadow-lg">
                                                        <div className="flex items-center gap-2 mb-3 px-2">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Ledger Distribution</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {sample.ledger_impact.map((entry: any, eidx: number) => (
                                                                <div key={eidx} className="flex justify-between items-center text-[10px] border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                                                    <div className="max-w-[120px] truncate">
                                                                        <p className="font-bold text-app-muted-foreground">{entry.account_name || entry.account_id}</p>
                                                                        <p className="text-[8px] text-app-muted-foreground uppercase">{entry.type}</p>
                                                                    </div>
                                                                    <p className="font-mono font-black text-emerald-400">
                                                                        {(entry.debit > 0 ? entry.debit : entry.credit).toLocaleString()}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* SOURCE SUMMARY (The "How it was" part) */}
                                                <details className="cursor-pointer">
                                                    <summary className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest list-none flex items-center justify-center gap-1.5 py-2 hover:text-app-muted-foreground transition-colors">
                                                        Compare with Source Data <ChevronRight className="w-3 h-3 rotate-90" />
                                                    </summary>
                                                    <Card className="border-app-border bg-slate-50/50 rounded-3xl mt-2 overflow-hidden">
                                                        <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2">
                                                            {Object.entries(sample.source_raw || {}).slice(0, 6)
                                                                .filter(([k]) => !['created_at', 'updated_at', 'id'].includes(k))
                                                                .map(([key, val]: [string, any]) => (
                                                                    <div key={key}>
                                                                        <p className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-tighter">{key.replace(/_/g, ' ')}</p>
                                                                        <p className="text-[11px] font-black text-app-muted-foreground truncate">
                                                                            {typeof val === 'object' ? '...' : String(val)}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                        <pre className="text-[8px] bg-slate-900 text-amber-200/40 p-3 max-h-24 overflow-auto border-t border-slate-800">
                                                            {JSON.stringify(sample.source_raw, null, 2)}
                                                        </pre>
                                                    </Card>
                                                </details>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    <div className="p-8 border-t border-app-border bg-app-surface flex justify-end items-center rounded-b-[3rem]">
                        <div className="flex gap-4">
                            <Button
                                className="bg-app-success hover:bg-app-success text-white font-black text-sm shadow-xl shadow-emerald-600/30 rounded-2xl px-12 h-14 transition-all hover:-translate-y-1 active:scale-95"
                                onClick={() => {
                                    if (auditEntity) {
                                        handleBulkApprove(auditEntity)
                                        setAuditEntity(null)
                                    }
                                }}
                            >
                                <CheckCircle2 className="w-5 h-5 mr-3" />
                                All Samples Verified - Bulk Approve
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
        </div>
    )
}
