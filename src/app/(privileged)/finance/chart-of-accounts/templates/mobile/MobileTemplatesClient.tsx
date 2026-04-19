// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileTemplatesClient — mobile-native Gallery view for the
 *  COA Templates library. Compare / Migration / Execution views
 *  are desktop-only; on mobile we show a link to open those on
 *  a larger screen.
 * ═══════════════════════════════════════════════════════════ */

import { useState, useMemo, useCallback } from 'react'
import {
    Library, Globe, Landmark, BookOpen, FileText, Flag, MapPin, Layers,
    Scale, Building2, CheckCircle2, Download, Hash, ChevronRight, Monitor,
    ArrowRightLeft, GitMerge, Zap, ListChecks,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { importChartOfAccountsTemplate } from '@/app/actions/finance/coa-templates'
import { MobileMasterPage } from '@/components/mobile/MobileMasterPage'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const ICON_MAP: Record<string, any> = {
    Globe, Landmark, BookOpen, FileText, Flag, MapPin, Library, Layers, Scale, Building2,
}
function resolveIcon(name?: string) {
    return (name && ICON_MAP[name]) || Globe
}

const ACCENT_MAP: Record<string, string> = {
    IFRS_COA: 'var(--app-info, #3b82f6)',
    USA_GAAP: '#8b5cf6',
    FRENCH_PCG: 'var(--app-primary)',
    SYSCOHADA_REVISED: 'var(--app-warning, #f59e0b)',
    LEBANESE_PCN: 'var(--app-error, #ef4444)',
}

interface TemplateInfo {
    key: string; name: string; region: string; description: string
    icon: string; accent_color: string; is_system: boolean; is_custom: boolean
    account_count: number; posting_rule_count: number
    version?: string; last_updated?: string
}

interface Props {
    templates: TemplateInfo[]
    templatesMap: Record<string, any>
    migrationMaps: Record<string, Record<string, string>>
}

export function MobileTemplatesClient({ templates, templatesMap }: Props) {
    const router = useRouter()
    const [detailNode, setDetailNode] = useState<TemplateInfo | null>(null)
    const [importTarget, setImportTarget] = useState<TemplateInfo | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [actionNode, setActionNode] = useState<TemplateInfo | null>(null)

    const stats = useMemo(() => {
        const totalAccounts = templates.reduce((s, t) => s + t.account_count, 0)
        const totalRules = templates.reduce((s, t) => s + t.posting_rule_count, 0)
        return {
            templates: templates.length,
            totalAccounts,
            totalRules,
            system: templates.filter(t => t.is_system).length,
        }
    }, [templates])

    const runImport = useCallback(async (tpl: TemplateInfo, strategy: 'append' | 'replace') => {
        setIsPending(true)
        try {
            const result = await importChartOfAccountsTemplate(tpl.key, strategy)
            if (result?.success) {
                toast.success(`Imported ${tpl.name}`)
                router.push('/finance/chart-of-accounts')
            } else {
                toast.error(result?.message || 'Import failed')
            }
        } catch (e: any) {
            toast.error(e?.message || 'Import failed')
        } finally {
            setIsPending(false)
            setImportTarget(null)
        }
    }, [router])

    const actionItems = useMemo(() => {
        if (!actionNode) return []
        return [
            { key: 'details', label: 'View details', hint: 'Accounts & rules', icon: <ListChecks size={16} />, variant: 'grid', onClick: () => setDetailNode(actionNode) },
            { key: 'import', label: 'Import', hint: 'Add to current COA', icon: <Download size={16} />, variant: 'grid', onClick: () => setImportTarget(actionNode) },
        ]
    }, [actionNode])

    return (
        <MobileMasterPage
            config={{
                title: 'COA Templates',
                subtitle: `${stats.templates} templates · library`,
                icon: <Library size={20} />,
                iconColor: 'var(--app-primary)',
                searchPlaceholder: 'Search templates…',
                primaryAction: {
                    label: 'Open on Desktop',
                    icon: <Monitor size={16} />,
                    onClick: () => toast.info('Compare, Migration and Execution views are desktop-only'),
                },
                secondaryActions: [
                    { label: 'Migration Tool', icon: <ArrowRightLeft size={14} />, href: '/finance/chart-of-accounts/migrate' },
                    { label: 'Back to COA', icon: <BookOpen size={14} />, href: '/finance/chart-of-accounts' },
                ],
                kpis: [
                    { label: 'Templates', value: stats.templates, icon: <Library size={13} />, color: 'var(--app-primary)' },
                    { label: 'Total Accounts', value: stats.totalAccounts, icon: <Hash size={13} />, color: 'var(--app-info, #3b82f6)' },
                    { label: 'Posting Rules', value: stats.totalRules, icon: <GitMerge size={13} />, color: '#8b5cf6' },
                    { label: 'System', value: stats.system, icon: <CheckCircle2 size={13} />, color: 'var(--app-success, #10b981)' },
                ],
                footerLeft: (
                    <>
                        <span>{stats.templates} templates</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.totalAccounts.toLocaleString()} accounts</span>
                    </>
                ),
                onRefresh: async () => { router.refresh(); await new Promise(r => setTimeout(r, 400)) },
            }}
            modals={
                <>
                    <MobileActionSheet
                        open={actionNode !== null}
                        onClose={() => setActionNode(null)}
                        title={actionNode?.name}
                        subtitle={actionNode ? `${actionNode.account_count} accounts · ${actionNode.region}` : undefined}
                        items={actionItems}
                    />
                    <ConfirmDialog
                        open={importTarget !== null}
                        onOpenChange={(o) => { if (!o) setImportTarget(null) }}
                        onConfirm={() => importTarget && runImport(importTarget, 'append')}
                        title={`Import "${importTarget?.name}"?`}
                        description={`This will append ${importTarget?.account_count ?? 0} accounts and ${importTarget?.posting_rule_count ?? 0} posting rules to your current Chart of Accounts.`}
                        confirmText="Import"
                        variant="info"
                    />
                </>
            }
            sheet={
                <MobileBottomSheet
                    open={detailNode !== null}
                    onClose={() => setDetailNode(null)}
                    initialSnap="expanded">
                    {detailNode && (
                        <TemplateDetail
                            template={detailNode}
                            full={templatesMap[detailNode.key]}
                            onImport={() => { setDetailNode(null); setImportTarget(detailNode) }}
                            onClose={() => setDetailNode(null)}
                        />
                    )}
                </MobileBottomSheet>
            }>
            {({ searchQuery }) => {
                const q = searchQuery.trim().toLowerCase()
                const filtered = q
                    ? templates.filter(t =>
                        t.name?.toLowerCase().includes(q)
                        || t.region?.toLowerCase().includes(q)
                        || t.key?.toLowerCase().includes(q)
                        || t.description?.toLowerCase().includes(q)
                    )
                    : templates

                if (filtered.length === 0) {
                    return (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <Library size={40} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="font-bold text-app-muted-foreground mb-1" style={{ fontSize: 'var(--tp-lg)' }}>
                                {q ? 'No matching templates' : 'No templates available'}
                            </p>
                            <p className="text-app-muted-foreground max-w-xs" style={{ fontSize: 'var(--tp-md)' }}>
                                {q ? 'Try a different search term.' : ''}
                            </p>
                        </div>
                    )
                }

                return filtered.map(tpl => {
                    const Icon = resolveIcon(tpl.icon)
                    const accent = ACCENT_MAP[tpl.key] || tpl.accent_color || 'var(--app-primary)'
                    return (
                        <button
                            key={tpl.key}
                            onClick={() => setDetailNode(tpl)}
                            onContextMenu={(e) => { e.preventDefault(); setActionNode(tpl) }}
                            className="w-full text-left rounded-2xl mb-2 p-3 active:scale-[0.99] transition-all"
                            style={{
                                background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 6%, var(--app-surface)) 0%, var(--app-surface) 100%)`,
                                border: `1px solid color-mix(in srgb, ${accent} 22%, var(--app-border))`,
                                contentVisibility: 'auto',
                                containIntrinsicSize: '0 130px',
                            }}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center justify-center flex-shrink-0 rounded-xl"
                                    style={{
                                        width: 40, height: 40,
                                        background: `color-mix(in srgb, ${accent} 15%, transparent)`,
                                        color: accent,
                                    }}>
                                    <Icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-black text-app-foreground truncate leading-tight"
                                        style={{ fontSize: 'var(--tp-xl)' }}>
                                        {tpl.name}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <MapPin size={10} style={{ color: accent }} />
                                        <span className="font-black uppercase tracking-widest truncate"
                                            style={{ fontSize: 'var(--tp-xxs)', color: accent }}>
                                            {tpl.region}
                                        </span>
                                        {tpl.is_system && (
                                            <span className="font-black uppercase tracking-widest rounded-full px-2 py-0.5 ml-1"
                                                style={{
                                                    fontSize: 'var(--tp-xxs)',
                                                    background: 'color-mix(in srgb, var(--app-success, #10b981) 14%, transparent)',
                                                    color: 'var(--app-success, #10b981)',
                                                }}>
                                                SYSTEM
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-app-muted-foreground flex-shrink-0" />
                            </div>
                            {tpl.description && (
                                <p className="text-app-muted-foreground line-clamp-2 mb-2"
                                    style={{ fontSize: 'var(--tp-md)' }}>
                                    {tpl.description}
                                </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="flex items-center gap-1 font-black tabular-nums rounded-lg px-2 py-1"
                                    style={{
                                        fontSize: 'var(--tp-xs)',
                                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',
                                        color: 'var(--app-info, #3b82f6)',
                                    }}>
                                    <Hash size={10} /> {tpl.account_count} accounts
                                </span>
                                <span className="flex items-center gap-1 font-black tabular-nums rounded-lg px-2 py-1"
                                    style={{
                                        fontSize: 'var(--tp-xs)',
                                        background: 'color-mix(in srgb, #8b5cf6 10%, transparent)',
                                        color: '#8b5cf6',
                                    }}>
                                    <GitMerge size={10} /> {tpl.posting_rule_count} rules
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setImportTarget(tpl) }}
                                    className="ml-auto flex items-center gap-1 font-black rounded-lg px-3 py-1 active:scale-95 transition-transform"
                                    style={{
                                        fontSize: 'var(--tp-xs)',
                                        color: '#fff',
                                        background: accent,
                                        boxShadow: `0 2px 8px color-mix(in srgb, ${accent} 30%, transparent)`,
                                    }}>
                                    <Download size={11} /> Import
                                </button>
                            </div>
                        </button>
                    )
                })
            }}
        </MobileMasterPage>
    )
}

/* Detail sheet — show top-level sections of the template */
function TemplateDetail({ template, full, onImport, onClose }: any) {
    const Icon = resolveIcon(template.icon)
    const accent = ACCENT_MAP[template.key] || template.accent_color || 'var(--app-primary)'
    const topLevelSections = (full?.accounts || []).slice(0, 20)

    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 px-3 pt-2 pb-3 flex items-center gap-2"
                style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 10%, var(--app-surface)), var(--app-surface))`,
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                }}>
                <div className="flex items-center justify-center flex-shrink-0 rounded-xl"
                    style={{
                        width: 40, height: 40,
                        background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 70%, #000))`,
                        boxShadow: `0 4px 14px color-mix(in srgb, ${accent} 30%, transparent)`,
                        color: '#fff',
                    }}>
                    <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-black text-app-foreground truncate leading-tight" style={{ fontSize: 'var(--tp-2xl)' }}>
                        {template.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-black uppercase tracking-widest" style={{ fontSize: 'var(--tp-xxs)', color: accent }}>
                            {template.region}
                        </span>
                        {template.version && (
                            <span className="font-mono text-app-muted-foreground" style={{ fontSize: 'var(--tp-xxs)' }}>
                                v{template.version}
                            </span>
                        )}
                    </div>
                </div>
                <button onClick={onClose}
                    className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
                    style={{
                        width: 36, height: 36,
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}
                    aria-label="Close">
                    <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {template.description && (
                    <p className="text-app-foreground" style={{ fontSize: 'var(--tp-md)' }}>
                        {template.description}
                    </p>
                )}

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <div className="rounded-2xl px-3 py-3"
                        style={{
                            background: `color-mix(in srgb, ${accent} 6%, var(--app-surface))`,
                            border: `1px solid color-mix(in srgb, ${accent} 20%, transparent)`,
                        }}>
                        <div className="font-black uppercase tracking-widest text-app-muted-foreground"
                            style={{ fontSize: 'var(--tp-xxs)' }}>Accounts</div>
                        <div className="font-black tabular-nums" style={{ fontSize: 'var(--tp-stat)' }}>
                            {template.account_count}
                        </div>
                    </div>
                    <div className="rounded-2xl px-3 py-3"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        }}>
                        <div className="font-black uppercase tracking-widest text-app-muted-foreground"
                            style={{ fontSize: 'var(--tp-xxs)' }}>Posting Rules</div>
                        <div className="font-black tabular-nums" style={{ fontSize: 'var(--tp-stat)' }}>
                            {template.posting_rule_count}
                        </div>
                    </div>
                </div>

                {/* Top-level preview */}
                {topLevelSections.length > 0 && (
                    <div>
                        <div className="font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 px-1"
                            style={{ fontSize: 'var(--tp-xs)' }}>
                            Account Structure
                        </div>
                        <div className="rounded-2xl overflow-hidden"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            }}>
                            {topLevelSections.map((acc: any, i: number) => (
                                <div key={`${acc.code}-${i}`}
                                    className="flex items-center gap-3 px-3 py-2.5"
                                    style={{ borderTop: i === 0 ? undefined : '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                                    <span className="font-mono font-black tabular-nums flex-shrink-0"
                                        style={{ fontSize: 'var(--tp-md)', color: accent, minWidth: 42 }}>
                                        {acc.code}
                                    </span>
                                    <span className="font-bold text-app-foreground truncate flex-1"
                                        style={{ fontSize: 'var(--tp-md)' }}>
                                        {acc.name}
                                    </span>
                                    {acc.type && (
                                        <span className="font-black uppercase tracking-widest text-app-muted-foreground flex-shrink-0"
                                            style={{ fontSize: 'var(--tp-xxs)' }}>
                                            {acc.type}
                                        </span>
                                    )}
                                </div>
                            ))}
                            {(full?.accounts?.length || 0) > topLevelSections.length && (
                                <div className="px-3 py-2 text-center font-bold text-app-muted-foreground"
                                    style={{ fontSize: 'var(--tp-xs)', borderTop: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                                    + {(full?.accounts?.length || 0) - topLevelSections.length} more
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2"
                style={{
                    borderTop: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                    background: 'var(--app-surface)',
                }}>
                <button onClick={onClose}
                    className="flex items-center justify-center gap-1.5 rounded-xl active:scale-[0.97] transition-transform font-bold flex-shrink-0"
                    style={{
                        fontSize: 'var(--tp-md)', height: 42, padding: '0 14px',
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}>
                    Close
                </button>
                <button
                    onClick={onImport}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl active:scale-[0.98] transition-transform font-black"
                    style={{
                        fontSize: 'var(--tp-md)', height: 42,
                        color: '#fff',
                        background: accent,
                        boxShadow: `0 2px 10px color-mix(in srgb, ${accent} 35%, transparent)`,
                    }}>
                    <Download size={14} /> Import this template
                </button>
            </div>
        </div>
    )
}
