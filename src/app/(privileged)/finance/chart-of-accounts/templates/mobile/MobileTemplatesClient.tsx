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
    ArrowRightLeft, GitMerge, Zap, ListChecks, ChevronDown,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { importChartOfAccountsTemplate } from '@/app/actions/finance/coa-templates'
import { MobileMasterPage } from '@/components/mobile/MobileMasterPage'
import { MobileActionSheet, type ActionItem } from '@/components/mobile/MobileActionSheet'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/finance-coa-templates-mobile'

type LucideIconLike = React.ComponentType<React.ComponentProps<'svg'> & { size?: number | string }>
const ICON_MAP: Record<string, LucideIconLike> = {
    Globe, Landmark, BookOpen, FileText, Flag, MapPin, Library, Layers, Scale, Building2,
}
function resolveIcon(name?: string) {
    return (name && ICON_MAP[name]) || Globe
}

const ACCENT_MAP: Record<string, string> = {
    IFRS_COA: 'var(--app-info, #3b82f6)',
    USA_GAAP: 'var(--app-info)',
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
    templatesMap: Record<string, unknown>
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
            const result = await importChartOfAccountsTemplate(tpl.key, { reset: strategy === 'replace' }) as { success?: boolean; message?: string } | undefined
            if (result?.success) {
                toast.success(`Imported ${tpl.name}`)
                router.push('/finance/chart-of-accounts')
            } else {
                toast.error(result?.message || 'Import failed')
            }
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Import failed')
        } finally {
            setIsPending(false)
            setImportTarget(null)
        }
    }, [router])

    const actionItems = useMemo<ActionItem[]>(() => {
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
                tourId: 'finance-coa-templates-mobile',
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
                    { label: 'Posting Rules', value: stats.totalRules, icon: <GitMerge size={13} />, color: 'var(--app-info)' },
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
                        onConfirm={() => { if (importTarget) void runImport(importTarget, 'append') }}
                        title={`Import "${importTarget?.name}"?`}
                        description={`This will append ${importTarget?.account_count ?? 0} accounts and ${importTarget?.posting_rule_count ?? 0} posting rules to your current Chart of Accounts.`}
                        confirmText="Import"
                        variant="info"
                    />
                    <PageTour tourId="finance-coa-templates-mobile" renderButton={false} />
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
                                    <div className="font-bold text-app-foreground truncate leading-tight"
                                        style={{ fontSize: 'var(--tp-xl)' }}>
                                        {tpl.name}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <MapPin size={10} style={{ color: accent }} />
                                        <span className="font-bold uppercase tracking-wide truncate"
                                            style={{ fontSize: 'var(--tp-xxs)', color: accent }}>
                                            {tpl.region}
                                        </span>
                                        {tpl.is_system && (
                                            <span className="font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ml-1"
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
                                <span className="flex items-center gap-1 font-bold tabular-nums rounded-lg px-2 py-1"
                                    style={{
                                        fontSize: 'var(--tp-xs)',
                                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',
                                        color: 'var(--app-info, #3b82f6)',
                                    }}>
                                    <Hash size={10} /> {tpl.account_count} accounts
                                </span>
                                <span className="flex items-center gap-1 font-bold tabular-nums rounded-lg px-2 py-1"
                                    style={{
                                        fontSize: 'var(--tp-xs)',
                                        background: 'color-mix(in srgb, var(--app-info) 10%, transparent)',
                                        color: 'var(--app-info)',
                                    }}>
                                    <GitMerge size={10} /> {tpl.posting_rule_count} rules
                                </span>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); setImportTarget(tpl) }}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); setImportTarget(tpl) } }}
                                    className="ml-auto flex items-center gap-1 font-bold rounded-lg px-3 py-1 active:scale-95 transition-transform cursor-pointer"
                                    style={{
                                        fontSize: 'var(--tp-xs)',
                                        color: '#fff',
                                        background: accent,
                                        boxShadow: `0 2px 8px color-mix(in srgb, ${accent} 30%, transparent)`,
                                    }}>
                                    <Download size={11} /> Import
                                </div>
                            </div>
                        </button>
                    )
                })
            }}
        </MobileMasterPage>
    )
}

/* Recursive account row — expandable when node has children */
function AccountTreeRow({ node, level, accent, defaultOpen }: {
    node: any
    level: number
    accent: string
    defaultOpen?: boolean
}) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0
    const [open, setOpen] = useState(!!defaultOpen)

    return (
        <div>
            <div
                onClick={() => hasChildren && setOpen(o => !o)}
                className={`flex items-center gap-2 px-2 rounded-lg transition-colors ${hasChildren ? 'cursor-pointer active:bg-app-primary/10' : ''}`}
                style={{
                    minHeight: 40,
                    paddingLeft: 8 + level * 14,
                    paddingRight: 8,
                    borderTop: level === 0 ? undefined : '1px dashed color-mix(in srgb, var(--app-border) 20%, transparent)',
                }}>
                {/* Chevron */}
                {hasChildren ? (
                    <span
                        className="flex items-center justify-center flex-shrink-0 rounded"
                        style={{
                            width: 22, height: 22,
                            background: open
                                ? `color-mix(in srgb, ${accent} 14%, transparent)`
                                : 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                            color: open ? accent : 'var(--app-muted-foreground)',
                            transition: 'transform 150ms, background 150ms',
                            transform: open ? 'rotate(90deg)' : 'none',
                        }}>
                        <ChevronRight size={13} />
                    </span>
                ) : (
                    <span className="flex-shrink-0" style={{
                        width: 6, height: 6, borderRadius: 999,
                        marginLeft: 8,
                        background: `color-mix(in srgb, ${accent} 35%, transparent)`,
                    }} />
                )}
                {/* Code */}
                <span className="font-mono font-bold tabular-nums flex-shrink-0"
                    style={{
                        fontSize: 'var(--tp-md)',
                        color: accent,
                        minWidth: 46,
                    }}>
                    {node.code}
                </span>
                {/* Name */}
                <span className={`flex-1 truncate ${level === 0 ? 'font-bold' : 'font-bold'} text-app-foreground`}
                    style={{ fontSize: 'var(--tp-md)' }}>
                    {node.name}
                </span>
                {/* Branch-scope chip — show on every row so the user can
                    see at a glance what scope each account belongs to. */}
                {(() => {
                    const c = node.scope_mode === 'branch_split'
                        ? { icon: '🏢', color: 'var(--app-warning, #F59E0B)' }
                        : node.scope_mode === 'branch_located'
                            ? { icon: '📦', color: 'var(--app-success, #10B981)' }
                            : node.scope_mode === 'tenant_wide'
                                ? { icon: '🌐', color: 'var(--app-info, #3B82F6)' }
                                : null
                    if (!c) return null
                    return (
                        <span className="flex-shrink-0 rounded-md font-bold"
                            style={{
                                fontSize: 'var(--tp-xxs)',
                                padding: '1px 4px',
                                color: c.color,
                                background: `color-mix(in srgb, ${c.color} 12%, transparent)`,
                            }}>
                            {c.icon}
                        </span>
                    )
                })()}
                {/* Type badge (only root) */}
                {level === 0 && node.type && (
                    <span className="font-bold uppercase tracking-wide text-app-muted-foreground flex-shrink-0"
                        style={{ fontSize: 'var(--tp-xxs)' }}>
                        {node.type}
                    </span>
                )}
                {/* Leaf child count hint */}
                {hasChildren && (
                    <span className="font-bold tabular-nums flex-shrink-0 rounded-full px-1.5 py-0.5"
                        style={{
                            fontSize: 'var(--tp-xxs)',
                            background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                            color: 'var(--app-muted-foreground)',
                            minWidth: 22, textAlign: 'center',
                        }}>
                        {node.children.length}
                    </span>
                )}
            </div>
            {hasChildren && open && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children.map((child: any, i: number) => (
                        <AccountTreeRow
                            key={`${child.code}-${i}`}
                            node={child}
                            level={level + 1}
                            accent={accent}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* Detail sheet — show account tree of the template (expandable) */
function TemplateDetail({ template, full, onImport, onClose }: any) {
    const Icon = resolveIcon(template.icon)
    const accent = ACCENT_MAP[template.key] || template.accent_color || 'var(--app-primary)'
    const roots = full?.accounts || []

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
                    <h3 className="truncate" style={{ fontSize: 'var(--tp-2xl)' }}>
                        {template.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-bold uppercase tracking-wide" style={{ fontSize: 'var(--tp-xxs)', color: accent }}>
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
                        <div className="font-bold uppercase tracking-wide text-app-muted-foreground"
                            style={{ fontSize: 'var(--tp-xxs)' }}>Accounts</div>
                        <div className="font-bold tabular-nums" style={{ fontSize: 'var(--tp-stat)' }}>
                            {template.account_count}
                        </div>
                    </div>
                    <div className="rounded-2xl px-3 py-3"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        }}>
                        <div className="font-bold uppercase tracking-wide text-app-muted-foreground"
                            style={{ fontSize: 'var(--tp-xxs)' }}>Posting Rules</div>
                        <div className="font-bold tabular-nums" style={{ fontSize: 'var(--tp-stat)' }}>
                            {template.posting_rule_count}
                        </div>
                    </div>
                </div>

                {/* Account tree — expandable */}
                {roots.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-1.5 px-1">
                            <div className="font-bold uppercase tracking-wide text-app-muted-foreground"
                                style={{ fontSize: 'var(--tp-xs)' }}>
                                Account Structure
                            </div>
                            <div className="font-bold text-app-muted-foreground tabular-nums"
                                style={{ fontSize: 'var(--tp-xxs)' }}>
                                {roots.length} root{roots.length === 1 ? '' : 's'}
                            </div>
                        </div>
                        <div className="rounded-2xl overflow-hidden py-1"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            }}>
                            {roots.map((acc: any, i: number) => (
                                <AccountTreeRow
                                    key={`${acc.code}-${i}`}
                                    node={acc}
                                    level={0}
                                    accent={accent}
                                />
                            ))}
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
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl active:scale-[0.98] transition-transform font-bold"
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
