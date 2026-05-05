'use client'

import { useState } from 'react'
import { Library, GitMerge, CheckCircle2, Zap, TreePine, Workflow } from 'lucide-react'
import { ACCENT_MAP } from './icons'
import type { TemplateInfo } from './types'
import { AccountTreeNode } from './AccountTreeNode'
import { PostingRulesPanel } from './PostingRulesPanel'
import { EmptyState } from './EmptyState'

// ══════════════════════════════════════════════════════════════════
// Compare View — Side by Side with Posting Rules
// ══════════════════════════════════════════════════════════════════
export function CompareView({
    templates, templatesMap, compareTemplates, onToggle, onImport, isPending,
}: {
    templates: TemplateInfo[]; templatesMap: Record<string, any>
    compareTemplates: string[]; onToggle: (key: string) => void
    onImport: (key: string) => void; isPending: boolean
}) {
    const [compareTab, setCompareTab] = useState<'accounts' | 'rules'>('accounts')

    return (
        <div>
            {/* Selection bar */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 no-scrollbar">
                {templates.map(t => {
                    const accent = ACCENT_MAP[t.key] || t.accent_color || 'var(--app-primary)'
                    const isSelected = compareTemplates.includes(t.key)
                    return (
                        <button key={t.key} onClick={() => onToggle(t.key)}
                            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all"
                            style={{
                                background: isSelected ? `color-mix(in srgb, ${accent} 8%, var(--app-surface))` : 'var(--app-surface)',
                                border: `1px solid ${isSelected ? `color-mix(in srgb, ${accent} 40%, transparent)` : 'var(--app-border)'}`,
                            }}>
                            {isSelected ? <CheckCircle2 size={14} style={{ color: accent }} /> : <Library size={14} className="text-app-muted-foreground" />}
                            <span className="text-tp-md font-bold whitespace-nowrap"
                                style={{ color: isSelected ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                {t.name}
                            </span>
                            <span className="text-tp-xs font-bold tabular-nums text-app-muted-foreground">{t.account_count}</span>
                        </button>
                    )
                })}
            </div>

            {compareTemplates.length === 0 ? (
                <EmptyState icon={GitMerge} text="Select two or more templates to compare" subtitle="Choose standards from the bar above." />
            ) : (
                <>
                    {/* Compare subtabs */}
                    <div className="flex items-center gap-1 mb-3 p-1 rounded-xl w-fit"
                        style={{ background: 'var(--app-surface-2, var(--app-surface))' }}>
                        <button onClick={() => setCompareTab('accounts')}
                            className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-1.5 rounded-lg transition-all"
                            style={{ background: compareTab === 'accounts' ? 'var(--app-primary)' : 'transparent',
                                color: compareTab === 'accounts' ? '#fff' : 'var(--app-muted-foreground)' }}>
                            <TreePine size={13} /> Account Trees
                        </button>
                        <button onClick={() => setCompareTab('rules')}
                            className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-1.5 rounded-lg transition-all"
                            style={{ background: compareTab === 'rules' ? 'var(--app-primary)' : 'transparent',
                                color: compareTab === 'rules' ? '#fff' : 'var(--app-muted-foreground)' }}>
                            <Workflow size={13} /> Posting Rules
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(compareTemplates.length, 4)}, 1fr)`, gap: '12px' }}>
                        {compareTemplates.map(key => {
                            const t = templates.find(tpl => tpl.key === key)
                            const detail = templatesMap[key]
                            const accent = ACCENT_MAP[key] || t?.accent_color || 'var(--app-primary)'
                            const accounts = detail?.accounts || []
                            const rules: any[] = detail?.posting_rules || []

                            // Group rules by module
                            const groupedRules: Record<string, any[]> = {}
                            for (const r of rules) {
                                const mod = r.module || 'general'
                                if (!groupedRules[mod]) groupedRules[mod] = []
                                groupedRules[mod].push(r)
                            }

                            return (
                                <div key={key} className="rounded-2xl overflow-hidden flex flex-col"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                    <div className="p-4 flex justify-between items-start"
                                        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 8%, var(--app-surface)), var(--app-surface))`,
                                            borderBottom: '1px solid var(--app-border)' }}>
                                        <div>
                                            <h3 className="text-tp-lg">{t?.name || key}</h3>
                                            <p className="text-tp-xs font-bold text-app-muted-foreground uppercase tracking-wider mt-0.5">
                                                {t?.region} · {compareTab === 'accounts' ? `${accounts.length} accts` : `${rules.length} rules`}
                                            </p>
                                        </div>
                                        <button disabled={isPending} onClick={() => onImport(key)}
                                            className="flex items-center gap-1 text-tp-xs font-bold text-white px-2.5 py-1.5 rounded-lg transition-all hover:brightness-110"
                                            style={{ background: accent }}>
                                            <Zap size={12} /> Import
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
                                        {compareTab === 'accounts' ? (
                                            accounts.map((item: any, i: number) => (
                                                <AccountTreeNode key={i} item={item} level={0} accent={accent} expandAll={false} />
                                            ))
                                        ) : (
                                            <PostingRulesPanel groupedRules={groupedRules} accent={accent} />
                                        )}
                                    </div>
                                    <div className="p-3 text-center" style={{ borderTop: '1px solid var(--app-border)' }}>
                                        <span className="text-tp-xs font-bold text-app-muted-foreground uppercase tracking-wide">
                                            {compareTab === 'accounts' ? `${accounts.length} root classes` : `${rules.length} posting rules`}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}
