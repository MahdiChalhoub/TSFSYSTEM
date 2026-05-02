'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
    Library, GitMerge, TreePine, ArrowRightLeft,
    ShieldCheck, GitBranch,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { importChartOfAccountsTemplate } from '@/app/actions/finance/coa-templates'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useTranslation } from '@/hooks/use-translation'
import '@/lib/tours/definitions/finance-coa-templates'

import type { Props } from './_components/types'
import { GalleryView } from './_components/GalleryView'
import { CompareView } from './_components/CompareView'
import { MigrationView } from './_components/migration/MigrationView'
import { MigrationExecutionView } from './_components/migration/MigrationExecutionView'
import { PageHeader, KpiStrip, Toolbar, PageFooter } from './_components/PageChrome'
import {
    afterImport, makeHandleImport, makeHandleConfirmImport, makeHandleConfirmReplace,
} from './_components/importHandlers'

export default function TemplatesPageClient({ templates, templatesMap, migrationMaps }: Props) {
    const router = useRouter()
    const { t } = useTranslation()
    const searchParams = useSearchParams()
    const cameFromCOA = searchParams.get('from') === 'coa'
    const [activeView, setActiveView] = useState<'gallery' | 'compare' | 'migration' | 'execution'>('gallery')
    const [migrationPreview, setMigrationPreview] = useState<import('@/app/actions/finance/coa-templates').MigrationPreview | null>(null)
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
    const [compareTemplates, setCompareTemplates] = useState<string[]>([])
    const [focusMode, setFocusMode] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isPending, setIsPending] = useState(false)
    const [importTarget, setImportTarget] = useState<string | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const filteredTemplates = useMemo(() => {
        if (!searchQuery) return templates
        const q = searchQuery.toLowerCase()
        return templates.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.key.toLowerCase().includes(q) ||
            t.region.toLowerCase().includes(q)
        )
    }, [templates, searchQuery])

    const totalAccounts = templates.reduce((sum, t) => sum + (t.account_count || 0), 0)
    const totalRules = templates.reduce((sum, t) => sum + (t.posting_rule_count || 0), 0)

    const [migrationTarget, setMigrationTarget] = useState<{ from: string; to: string } | null>(null)
    const [coaStatus, setCoaStatus] = useState<any>(null)
    const [replaceTarget, setReplaceTarget] = useState<string | null>(null)

    const handleImport = makeHandleImport({
        setCoaStatus, setImportTarget, setReplaceTarget,
        setMigrationTarget, setMigrationPreview, setActiveView, setIsPending,
    })
    const handleConfirmImport = makeHandleConfirmImport(importTarget, setImportTarget, setIsPending)
    const handleConfirmReplace = makeHandleConfirmReplace(replaceTarget, setReplaceTarget, setIsPending)

    const toggleCompare = (key: string) => {
        setCompareTemplates(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        )
    }

    // ── KPI Data ──
    const kpis = [
        { label: t('finance.coa_templates_page.kpi_templates'),       value: templates.length, icon: <Library size={14} />, color: 'var(--app-primary)' },
        { label: t('finance.coa_templates_page.kpi_total_accounts'),  value: totalAccounts.toLocaleString(), icon: <TreePine size={14} />, color: 'var(--app-info, #3b82f6)' },
        { label: t('finance.coa_templates_page.kpi_posting_rules'),   value: totalRules.toLocaleString(), icon: <GitBranch size={14} />, color: 'var(--app-info)' },
        { label: t('finance.coa_templates_page.kpi_migrations'),      value: Object.keys(migrationMaps).length, icon: <ArrowRightLeft size={14} />, color: 'var(--app-warning, #f59e0b)' },
        { label: t('finance.coa_templates_page.kpi_system'),          value: templates.filter(tpl => tpl.is_system).length, icon: <ShieldCheck size={14} />, color: 'var(--app-success, #22c55e)' },
    ]

    const TABS = [
        { id: 'gallery' as const,   label: t('finance.coa_templates_page.tab_gallery'),   icon: Library },
        { id: 'compare' as const,   label: t('finance.coa_templates_page.tab_compare'),   icon: GitMerge },
        { id: 'migration' as const, label: t('finance.coa_templates_page.tab_migration'), icon: ArrowRightLeft },
    ]

    // Interactive tour step actions — drives the view-switcher so users see each mode in action
    const tourStepActions = useMemo(() => ({
        3: () => setActiveView('gallery'),
        5: () => setActiveView('compare'),
        7: () => setActiveView('migration'),
        9: () => setActiveView('gallery'),
    }), [])

    return (
        <div className="flex flex-col p-4 md:p-6 animate-in fade-in duration-300 overflow-hidden"
            style={{ height: 'calc(100dvh - 6rem)' }}>

            {!focusMode && (
                <PageHeader
                    cameFromCOA={cameFromCOA}
                    router={router}
                    templates={templates}
                    TABS={TABS}
                    activeView={activeView}
                    setActiveView={setActiveView}
                    setFocusMode={setFocusMode}
                    tourStepActions={tourStepActions}
                />
            )}

            {!focusMode && <KpiStrip kpis={kpis} />}

            <Toolbar
                focusMode={focusMode}
                TABS={TABS}
                activeView={activeView}
                setActiveView={setActiveView}
                searchRef={searchRef}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setFocusMode={setFocusMode}
                tourStepActions={tourStepActions}
            />

            {/* ── Content (stretches to fill all space between toolbar and footer).
                Only round the top corners — the footer rounds its own bottom
                corners, and rounding both produces a visible gap at the seam. */}
            <div data-tour="templates-content" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-t-2xl"
                style={{ borderTop: '1px solid var(--app-border)', borderLeft: '1px solid var(--app-border)', borderRight: '1px solid var(--app-border)' }}>
                {activeView === 'gallery' && (
                    <GalleryView templates={filteredTemplates} templatesMap={templatesMap}
                        selectedTemplate={selectedTemplate} onSelect={setSelectedTemplate}
                        onImport={handleImport} isPending={isPending} />
                )}
                {activeView === 'compare' && (
                    <CompareView templates={filteredTemplates} templatesMap={templatesMap}
                        compareTemplates={compareTemplates} onToggle={toggleCompare}
                        onImport={handleImport} isPending={isPending} />
                )}
                {activeView === 'migration' && (
                    <MigrationView templates={templates} templatesMap={templatesMap}
                        migrationMaps={migrationMaps}
                        autoMigration={migrationTarget}
                        accountBalances={coaStatus?.accounts || []}
                        onApplyImport={async (key, accountMapping) => {
                            setIsPending(true)
                            try {
                                await importChartOfAccountsTemplate(key as any, {
                                    reset: true,
                                    account_mapping: accountMapping,
                                })
                                afterImport(key.replace(/_/g, ' '))
                            } catch (e: unknown) {
                                toast.error(t('finance.coa_templates_page.error_prefix') + ': ' + (e instanceof Error ? e.message : String(e)))
                            } finally {
                                setIsPending(false)
                            }
                        }}
                        isPending={isPending}
                    />
                )}
                {activeView === 'execution' && migrationPreview && migrationTarget && (
                    <MigrationExecutionView
                        preview={migrationPreview}
                        targetTemplateKey={migrationTarget.to}
                        sourceTemplateKey={migrationTarget.from}
                        onApply={async (accountMapping) => {
                            setIsPending(true)
                            try {
                                await importChartOfAccountsTemplate(migrationTarget.to as any, {
                                    reset: true,
                                    account_mapping: accountMapping,
                                })
                                afterImport(migrationTarget.to.replace(/_/g, ' '))
                            } catch (e: unknown) {
                                toast.error(t('finance.coa_templates_page.error_prefix') + ': ' + (e instanceof Error ? e.message : String(e)))
                            } finally {
                                setIsPending(false)
                            }
                        }}
                        onCancel={() => setActiveView('gallery')}
                        isPending={isPending}
                    />
                )}
            </div>

            <PageFooter
                filteredCount={filteredTemplates.length}
                totalCount={templates.length}
                totalAccounts={totalAccounts}
                totalRules={totalRules}
                activeView={activeView}
            />

            {/* ── Import Dialog (Case 1: empty COA, or Case 2: same-template refresh) ── */}
            <ConfirmDialog open={importTarget !== null}
                onOpenChange={(open) => { if (!open) setImportTarget(null) }}
                onConfirm={handleConfirmImport}
                title={t('finance.coa_templates_page.import_title').replace('{template}', importTarget?.replace(/_/g, ' ') ?? '')}
                description={
                    coaStatus?.account_count
                        ? t('finance.coa_templates_page.import_desc_refresh').replace('{template}', importTarget?.replace(/_/g, ' ') ?? '')
                        : t('finance.coa_templates_page.import_desc_setup')
                }
                confirmText={t('finance.coa_templates_page.import_confirm')} variant="info" />

            {/* ── Replace Dialog (Case 2: untouched COA, safe to replace) ── */}
            <ConfirmDialog open={replaceTarget !== null}
                onOpenChange={(open) => { if (!open) setReplaceTarget(null) }}
                onConfirm={handleConfirmReplace}
                title={t('finance.coa_templates_page.replace_title').replace('{template}', replaceTarget?.replace(/_/g, ' ') ?? '')}
                description={t('finance.coa_templates_page.replace_desc').replace('{current}', coaStatus?.current_template?.replace(/_/g, ' ') ?? 'unknown')}
                confirmText={t('finance.coa_templates_page.replace_confirm')} variant="danger" />
        </div>
    )
}
