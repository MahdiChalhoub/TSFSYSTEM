'use client'

import { useState, useMemo } from 'react'
import {
    Search, ChevronLeft, Layers, Zap, FileText, Loader2, TreePine, Workflow,
} from 'lucide-react'
import { ACCENT_MAP, resolveIcon } from './icons'
import type { TemplateInfo } from './types'
import { AccountTreeNode } from './AccountTreeNode'
import { PostingRulesPanel } from './PostingRulesPanel'
import { EmptyState } from './EmptyState'

// ══════════════════════════════════════════════════════════════════
// Template Detail — Tabs: Accounts / Posting Rules
// ══════════════════════════════════════════════════════════════════
export function TemplateDetail({
    template, detail, onClose, onImport, isPending,
}: {
    template: TemplateInfo; detail: any
    onClose: () => void; onImport: (key: string) => void; isPending: boolean
}) {
    const [expandAll, setExpandAll] = useState(false)
    const [detailTab, setDetailTab] = useState<'accounts' | 'rules'>('accounts')
    const [ruleSearch, setRuleSearch] = useState('')
    const accent = ACCENT_MAP[template.key] || template.accent_color || 'var(--app-primary)'
    const accounts = detail?.accounts || []
    const postingRules: any[] = detail?.posting_rules || []

    // Group rules by module
    const groupedRules = useMemo(() => {
        const q = ruleSearch.toLowerCase()
        const filtered = q
            ? postingRules.filter(r => r.event_code.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.account_code.toLowerCase().includes(q))
            : postingRules
        const groups: Record<string, any[]> = {}
        for (const r of filtered) {
            const mod = r.module || 'general'
            if (!groups[mod]) groups[mod] = []
            groups[mod].push(r)
        }
        return groups
    }, [postingRules, ruleSearch])

    return (
        <div className="flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden animate-in slide-in-from-right-4 duration-300"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>

            {/* Header */}
            <div className="flex-shrink-0 px-5 py-3 flex items-center justify-between"
                style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 6%, var(--app-surface)), var(--app-surface))`,
                    borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-3">
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <ChevronLeft size={16} />
                    </button>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: accent, boxShadow: `0 4px 12px color-mix(in srgb, ${accent} 30%, transparent)` }}>
                        {(() => { const I = resolveIcon(template.icon); return <I size={16} className="text-white" /> })()}
                    </div>
                    <div>
                        <h3>{template.name}</h3>
                        <p className="text-tp-xs font-bold text-app-muted-foreground uppercase tracking-wider">
                            {template.region} · {accounts.length} accts · {postingRules.length} rules
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button disabled={isPending} onClick={() => onImport(template.key)}
                        className="flex items-center gap-1.5 text-tp-sm font-bold text-white px-3 py-1.5 rounded-xl transition-all hover:brightness-110"
                        style={{ background: accent, boxShadow: `0 2px 8px color-mix(in srgb, ${accent} 25%, transparent)` }}>
                        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                        <span className="hidden sm:inline">Import</span>
                    </button>
                </div>
            </div>

            {/* Detail Tabs */}
            <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2"
                style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
                <button onClick={() => setDetailTab('accounts')}
                    className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: detailTab === 'accounts' ? `color-mix(in srgb, ${accent} 10%, transparent)` : 'transparent',
                        color: detailTab === 'accounts' ? accent : 'var(--app-muted-foreground)' }}>
                    <TreePine size={13} /> Accounts ({accounts.length})
                </button>
                <button onClick={() => setDetailTab('rules')}
                    className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: detailTab === 'rules' ? `color-mix(in srgb, ${accent} 10%, transparent)` : 'transparent',
                        color: detailTab === 'rules' ? accent : 'var(--app-muted-foreground)' }}>
                    <Workflow size={13} /> Posting Rules ({postingRules.length})
                </button>
                {detailTab === 'accounts' && (
                    <button onClick={() => setExpandAll(!expandAll)}
                        className="ml-auto flex items-center gap-1 text-tp-xs font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-lg transition-all">
                        <Layers size={12} /> {expandAll ? 'Collapse' : 'Expand'}
                    </button>
                )}
                {detailTab === 'rules' && (
                    <div className="ml-auto relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input type="text" value={ruleSearch} onChange={e => setRuleSearch(e.target.value)}
                            placeholder="Filter rules..."
                            className="pl-7 pr-2 py-1 text-tp-sm bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground outline-none w-40" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {detailTab === 'accounts' ? (
                    accounts.length > 0 ? (
                        <div>
                            {accounts.map((item: any, i: number) => (
                                <AccountTreeNode key={i} item={item} level={0} accent={accent} expandAll={expandAll} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState icon={FileText} text="No accounts in this template" />
                    )
                ) : (
                    <PostingRulesPanel groupedRules={groupedRules} accent={accent} />
                )}
            </div>
        </div>
    )
}
