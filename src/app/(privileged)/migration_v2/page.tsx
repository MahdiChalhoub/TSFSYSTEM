'use client'

/**
 * Migration v2 — Import Hub
 * ==========================
 * Root landing page for data migration.
 * Step 1: Select what to import (module scope)
 * Step 2: Select where from (source system)
 * Then routes to the wizard at /migration_v2/jobs/new with query params.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Package, Users, ShoppingCart, Layers, Database,
    FileSpreadsheet, Plug, ArrowRight, ArrowLeft,
    Monitor, History, Box, ChevronRight
} from 'lucide-react'

// ─── Module Scope Options ───────────────────────────────────────

const IMPORT_MODULES = [
    {
        id: 'FULL',
        label: 'Full Migration',
        description: 'Products, Contacts, Transactions, Stock — everything',
        icon: Layers,
        color: 'bg-emerald-50 dark:bg-emerald-900/30',
        iconColor: 'text-emerald-600',
        badge: 'Recommended',
        badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    {
        id: 'PRODUCTS',
        label: 'Products Only',
        description: 'Units, Categories, Brands, Products, Variants',
        icon: Package,
        color: 'bg-blue-50 dark:bg-blue-900/30',
        iconColor: 'text-blue-600',
    },
    {
        id: 'CONTACTS',
        label: 'Contacts Only',
        description: 'Customers, Suppliers, with auto-COA sub-accounts',
        icon: Users,
        color: 'bg-purple-50 dark:bg-purple-900/30',
        iconColor: 'text-purple-600',
    },
    {
        id: 'TRANSACTIONS',
        label: 'Transactions',
        description: 'Sales, Purchases, Payments, Journal Entries',
        icon: ShoppingCart,
        color: 'bg-orange-50 dark:bg-orange-900/30',
        iconColor: 'text-orange-600',
    },
    {
        id: 'STOCK',
        label: 'Stock / Inventory',
        description: 'Opening stock balances and reconciliation',
        icon: Box,
        color: 'bg-cyan-50 dark:bg-cyan-900/30',
        iconColor: 'text-cyan-600',
    },
]

// ─── Source System Options ───────────────────────────────────────

const SOURCE_SYSTEMS = [
    {
        id: 'ULTIMATE_POS',
        label: 'UltimatePOS',
        description: 'Import from UltimatePOS SQL database dump',
        icon: Database,
        color: 'bg-blue-50 dark:bg-blue-900/30',
        iconColor: 'text-blue-600',
        available: true,
    },
    {
        id: 'EXCEL_CSV',
        label: 'Excel / CSV',
        description: 'Import from spreadsheets (products, contacts, stock)',
        icon: FileSpreadsheet,
        color: 'bg-green-50 dark:bg-green-900/30',
        iconColor: 'text-green-600',
        available: false,
    },
    {
        id: 'CUSTOM_API',
        label: 'Custom API',
        description: 'Connect to another POS or ERP system via API',
        icon: Plug,
        color: 'bg-purple-50 dark:bg-purple-900/30',
        iconColor: 'text-purple-600',
        available: false,
    },
]

export default function MigrationImportHub() {
    const router = useRouter()
    const [step, setStep] = useState<'module' | 'source'>('module')
    const [selectedModule, setSelectedModule] = useState<string | null>(null)
    const [selectedSource, setSelectedSource] = useState<string | null>(null)

    function handleModuleSelect(moduleId: string) {
        setSelectedModule(moduleId)
        setStep('source')
    }

    function handleSourceSelect(sourceId: string) {
        setSelectedSource(sourceId)
        // Navigate to wizard with params
        const params = new URLSearchParams()
        if (selectedModule) params.set('scope', selectedModule)
        params.set('source', sourceId)
        router.push(`/migration_v2/jobs/new?${params.toString()}`)
    }

    return (
        <div className="min-h-screen bg-app-bg p-4 md:p-8">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <Monitor className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-app-foreground tracking-tight">
                            Data Import
                        </h1>
                        <p className="text-sm text-app-muted-foreground font-medium mt-0.5">
                            Migrate your data into TSFSYSTEM
                        </p>
                    </div>
                </div>

                {/* Breadcrumb / Progress */}
                <div className="flex items-center gap-2 text-sm font-bold mb-6">
                    <button
                        onClick={() => setStep('module')}
                        className={`px-3 py-1.5 rounded-lg transition-colors ${step === 'module'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'text-app-muted-foreground hover:text-app-foreground'
                            }`}
                    >
                        1. What to import
                    </button>
                    <ChevronRight size={14} className="text-app-muted-foreground" />
                    <span
                        className={`px-3 py-1.5 rounded-lg ${step === 'source'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'text-app-muted-foreground'
                            }`}
                    >
                        2. Import source
                    </span>
                    <ChevronRight size={14} className="text-app-muted-foreground" />
                    <span className="text-app-muted-foreground px-3 py-1.5">
                        3. Configure & run
                    </span>
                </div>

                {/* ─── Step 1: Select Module ─── */}
                {step === 'module' && (
                    <div className="space-y-4">
                        <div className="mb-6">
                            <h2 className="text-xl font-black text-app-foreground">
                                What do you want to import?
                            </h2>
                            <p className="text-sm text-app-muted-foreground mt-1">
                                Choose the scope of your data migration
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {IMPORT_MODULES.map(mod => {
                                const Icon = mod.icon
                                const isSelected = selectedModule === mod.id
                                return (
                                    <button
                                        key={mod.id}
                                        onClick={() => handleModuleSelect(mod.id)}
                                        className={`text-left p-5 rounded-2xl border-2 transition-all group hover:shadow-lg ${isSelected
                                                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 shadow-md'
                                                : 'border-app-border bg-app-surface hover:border-emerald-400/50'
                                            } ${mod.id === 'FULL' ? 'md:col-span-2' : ''}`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={`w-12 h-12 rounded-xl ${mod.color} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                                                <Icon className={`w-6 h-6 ${mod.iconColor}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-black text-app-foreground">{mod.label}</h3>
                                                    {mod.badge && (
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${mod.badgeColor}`}>
                                                            {mod.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-app-muted-foreground mt-1">{mod.description}</p>
                                            </div>
                                            <ArrowRight size={16} className="text-app-muted-foreground mt-1 shrink-0 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Quick link to existing jobs */}
                        <div className="mt-8 pt-6 border-t border-app-border">
                            <button
                                onClick={() => router.push('/migration_v2/jobs')}
                                className="flex items-center gap-3 text-sm font-bold text-app-muted-foreground hover:text-app-foreground transition-colors group"
                            >
                                <History size={16} />
                                <span>View previous migration jobs</span>
                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── Step 2: Select Source ─── */}
                {step === 'source' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-6">
                            <button
                                onClick={() => setStep('module')}
                                className="w-9 h-9 rounded-lg border border-app-border flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-colors"
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <div>
                                <h2 className="text-xl font-black text-app-foreground">
                                    Where are you importing from?
                                </h2>
                                <p className="text-sm text-app-muted-foreground mt-0.5">
                                    Importing: <span className="font-bold text-emerald-600">{IMPORT_MODULES.find(m => m.id === selectedModule)?.label}</span>
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {SOURCE_SYSTEMS.map(source => {
                                const Icon = source.icon
                                return source.available ? (
                                    <button
                                        key={source.id}
                                        onClick={() => handleSourceSelect(source.id)}
                                        className="text-left p-6 rounded-2xl bg-app-surface border-2 border-app-border hover:border-emerald-500 hover:shadow-lg transition-all group"
                                    >
                                        <div className={`w-14 h-14 rounded-xl ${source.color} flex items-center justify-center mb-4 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 transition-colors`}>
                                            <Icon className={`w-7 h-7 ${source.iconColor} group-hover:text-emerald-600 transition-colors`} />
                                        </div>
                                        <h3 className="text-lg font-black text-app-foreground">{source.label}</h3>
                                        <p className="text-xs text-app-muted-foreground mt-1">{source.description}</p>
                                        <span className="inline-block mt-3 px-2.5 py-1 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 uppercase">
                                            Available
                                        </span>
                                    </button>
                                ) : (
                                    <div
                                        key={source.id}
                                        className="text-left p-6 rounded-2xl bg-app-surface border border-app-border opacity-60 cursor-not-allowed"
                                    >
                                        <div className={`w-14 h-14 rounded-xl ${source.color} flex items-center justify-center mb-4`}>
                                            <Icon className={`w-7 h-7 ${source.iconColor}`} />
                                        </div>
                                        <h3 className="text-lg font-black text-app-foreground">{source.label}</h3>
                                        <p className="text-xs text-app-muted-foreground mt-1">{source.description}</p>
                                        <span className="inline-block mt-3 px-2.5 py-1 rounded-full text-[9px] font-black bg-app-surface theme-text-muted bg-app-surface dark:theme-text-muted uppercase">
                                            Coming Soon
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
