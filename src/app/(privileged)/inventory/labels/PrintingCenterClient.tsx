// @ts-nocheck
'use client'

import { useState, useTransition, useCallback } from 'react'
import {
    Tag, History, Layout, Monitor, Wrench,
} from 'lucide-react'
import LabelsQueueTab from './tabs/LabelsQueueTab'
import SessionsTab from './tabs/SessionsTab'
import LayoutTab from './tabs/LayoutTab'
import OutputTab from './tabs/OutputTab'
import MaintenanceTab from './tabs/MaintenanceTab'
import { listPrintSessions, getPrintingKPI } from '@/app/actions/labels'

const v = (name: string) => `var(${name})`
const soft = (varName: string, pct = 10) => ({ backgroundColor: `color-mix(in srgb, ${v(varName)} ${pct}%, transparent)` })
const grad = (varName: string) => ({ background: `linear-gradient(135deg, ${v(varName)}, color-mix(in srgb, ${v(varName)} 80%, black))` })

const TABS = [
    { key: 'labels', label: 'Labels & Barcodes', icon: Tag, role: 'Create work' },
    { key: 'sessions', label: 'Sessions', icon: History, role: 'Track work' },
    { key: 'layout', label: 'Layout', icon: Layout, role: 'Define output' },
    { key: 'output', label: 'Output', icon: Monitor, role: 'Execute printing' },
    { key: 'maintenance', label: 'Maintenance', icon: Wrench, role: 'System health' },
] as const

type TabKey = typeof TABS[number]['key']

interface Props {
    products: any[]
    sessions: any[]
    templates: any[]
    printers: any[]
    kpi: any
}

export default function PrintingCenterClient({ products, sessions: initSessions, templates, printers, kpi: initKpi }: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>('labels')
    const [sessions, setSessions] = useState(initSessions)
    const [kpi, setKpi] = useState(initKpi)
    const [, startTransition] = useTransition()

    const refreshData = useCallback(() => {
        startTransition(async () => {
            const [sessRes, kpiRes] = await Promise.all([
                listPrintSessions(),
                getPrintingKPI(),
            ])
            setSessions(sessRes?.results || [])
            setKpi(kpiRes || {})
        })
    }, [])

    return (
        <div className="space-y-5">
            {/* ── Page Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-black text-app-foreground tracking-tight">Printing Center</h1>
                    <p className="text-[11px] text-app-muted-foreground mt-0.5">Label & barcode print operations</p>
                </div>
                {/* KPI strip */}
                <div className="flex items-center gap-3">
                    {[
                        { label: 'Pending', value: kpi?.labels_pending || 0, color: '--app-info' },
                        { label: 'Printing', value: kpi?.printing || 0, color: '--app-warning' },
                        { label: 'Completed', value: kpi?.labels_printed || 0, color: '--app-success' },
                        { label: 'Failed', value: kpi?.failed || 0, color: '--app-error' },
                    ].map(k => (
                        <div key={k.label} className="px-3 py-1.5 rounded-xl border border-app-border/30" style={soft(k.color, 5)}>
                            <p className="text-[16px] font-black" style={{ color: v(k.color) }}>{k.value}</p>
                            <p className="text-[8px] font-bold text-app-muted-foreground uppercase">{k.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Tab Bar ── */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-app-background border border-app-border/50">
                {TABS.map(tab => {
                    const active = activeTab === tab.key
                    const Icon = tab.icon
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all ${active ? 'text-app-foreground shadow-md' : 'text-app-muted-foreground hover:text-app-foreground'}`}
                            style={active ? { background: v('--app-surface'), borderColor: v('--app-border') } : {}}>
                            <Icon size={15} style={active ? { color: v('--app-primary') } : {}} />
                            <span>{tab.label}</span>
                            <span className="text-[8px] font-semibold text-app-muted-foreground hidden xl:inline">{tab.role}</span>
                        </button>
                    )
                })}
            </div>

            {/* ── Tab Content ── */}
            {activeTab === 'labels' && (
                <LabelsQueueTab initialProducts={products} onSessionCreated={refreshData} />
            )}
            {activeTab === 'sessions' && (
                <SessionsTab initialSessions={sessions} onRefresh={refreshData} />
            )}
            {activeTab === 'layout' && (
                <LayoutTab initialTemplates={templates} />
            )}
            {activeTab === 'output' && (
                <OutputTab initialPrinters={printers} sessions={sessions} />
            )}
            {activeTab === 'maintenance' && (
                <MaintenanceTab sessions={sessions} printers={printers} templates={templates} kpi={kpi} onRefresh={refreshData} />
            )}
        </div>
    )
}
