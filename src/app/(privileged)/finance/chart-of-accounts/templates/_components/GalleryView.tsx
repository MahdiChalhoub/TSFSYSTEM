'use client'

import { Library, MapPin, ArrowRight, TreePine, Workflow } from 'lucide-react'
import { ACCENT_MAP, resolveIcon } from './icons'
import type { TemplateInfo } from './types'
import { TemplateDetail } from './TemplateDetail'

// ══════════════════════════════════════════════════════════════════
// Gallery View — Card Grid with Detail sidebar
// ══════════════════════════════════════════════════════════════════
export function GalleryView({
    templates, templatesMap, selectedTemplate, onSelect, onImport, isPending,
}: {
    templates: TemplateInfo[]; templatesMap: Record<string, any>
    selectedTemplate: string | null; onSelect: (key: string | null) => void
    onImport: (key: string) => void; isPending: boolean
}) {
    if (templates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <Library size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                <p className="text-sm font-bold text-app-muted-foreground">No templates found</p>
                <p className="text-tp-sm text-app-muted-foreground mt-1">
                    Run <code className="font-mono bg-app-surface px-1 rounded">python manage.py seed_coa_templates</code>
                </p>
            </div>
        )
    }

    if (selectedTemplate && templatesMap[selectedTemplate]) {
        return (
            <div className="flex gap-4 h-full animate-in fade-in duration-200">
                {/* Left sidebar */}
                <div className="w-64 flex-shrink-0 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {templates.map(t => {
                        const accent = ACCENT_MAP[t.key] || t.accent_color || 'var(--app-primary)'
                        const isActive = selectedTemplate === t.key
                        return (
                            <button key={t.key} onClick={() => onSelect(t.key)}
                                className="w-full text-left p-3 rounded-xl transition-all"
                                style={{
                                    background: isActive ? `color-mix(in srgb, ${accent} 8%, var(--app-surface))` : 'var(--app-surface)',
                                    border: `1px solid ${isActive ? `color-mix(in srgb, ${accent} 30%, transparent)` : 'var(--app-border)'}`,
                                    borderLeft: isActive ? `3px solid ${accent}` : undefined,
                                }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}>
                                        {(() => { const I = resolveIcon(t.icon); return <I size={14} /> })()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-tp-md font-bold text-app-foreground truncate">{t.name}</div>
                                        <div className="text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wider">{t.region}</div>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
                {/* Right detail */}
                <TemplateDetail
                    template={templates.find(t => t.key === selectedTemplate)!}
                    detail={templatesMap[selectedTemplate]}
                    onClose={() => onSelect(null)}
                    onImport={onImport} isPending={isPending}
                />
            </div>
        )
    }

    // Default card grid
    return (
        <div className="p-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {templates.map(t => {
                const accent = ACCENT_MAP[t.key] || t.accent_color || 'var(--app-primary)'
                return (
                    <button key={t.key} onClick={() => onSelect(t.key)}
                        className="text-left rounded-2xl transition-all hover:scale-[1.01] group overflow-hidden"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="p-4 pb-3" style={{
                            background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 8%, var(--app-surface)), var(--app-surface))`,
                            borderBottom: '1px solid var(--app-border)',
                        }}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent,
                                            boxShadow: `0 4px 12px color-mix(in srgb, ${accent} 20%, transparent)` }}>
                                        {(() => { const I = resolveIcon(t.icon); return <I size={20} /> })()}
                                    </div>
                                    <div>
                                        <h3>{t.name}</h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <MapPin size={10} style={{ color: accent }} />
                                            <span className="text-tp-xs font-bold uppercase tracking-wider" style={{ color: accent }}>{t.region}</span>
                                        </div>
                                    </div>
                                </div>
                                {t.is_system && (
                                    <span className="text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                                            color: 'var(--app-success, #22c55e)', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)' }}>
                                        System
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="p-4 pt-3">
                            <p className="text-tp-sm font-medium text-app-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">
                                {t.description || 'Standard accounting template'}
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <TreePine size={12} style={{ color: accent }} />
                                    <span className="text-tp-sm font-bold text-app-foreground tabular-nums">{t.account_count}</span>
                                    <span className="text-tp-xs font-bold text-app-muted-foreground">accounts</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Workflow size={12} className="text-app-muted-foreground" />
                                    <span className="text-tp-sm font-bold text-app-foreground tabular-nums">{t.posting_rule_count}</span>
                                    <span className="text-tp-xs font-bold text-app-muted-foreground">rules</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-end mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-tp-xs font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: accent }}>
                                    View Details <ArrowRight size={12} />
                                </span>
                            </div>
                        </div>
                    </button>
                )
            })}
        </div>
    )
}
