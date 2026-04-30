'use client'

import { ChevronRight } from 'lucide-react'

export type ModuleNavItem = {
    key: string
    label: string
    color: string
    count: number
    dirty: number
}

interface ModuleNavigatorProps {
    items: ModuleNavItem[]
    selected: string
    onSelect: (key: string) => void
    sectionLabel?: string
}

export function ModuleNavigator({ items, selected, onSelect, sectionLabel }: ModuleNavigatorProps) {
    return (
        <aside
            className="flex flex-col rounded-2xl overflow-hidden self-start sticky top-4"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}
        >
            {sectionLabel && (
                <div
                    className="px-3 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-app-muted-foreground"
                    style={{
                        borderBottom: `1px solid color-mix(in srgb, var(--app-border) 40%, transparent)`,
                        background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                    }}
                >
                    {sectionLabel}
                </div>
            )}
            <nav className="flex flex-col p-1.5 gap-0.5" role="tablist" aria-label="Module navigator">
                {items.map(item => {
                    const active = item.key === selected
                    return (
                        <button
                            key={item.key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => onSelect(item.key)}
                            className="group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                            style={{
                                background: active
                                    ? `color-mix(in srgb, ${item.color} 10%, transparent)`
                                    : 'transparent',
                                border: `1px solid ${active
                                    ? `color-mix(in srgb, ${item.color} 28%, transparent)`
                                    : 'transparent'}`,
                            }}
                        >
                            {/* Left color rail — visible only when active */}
                            <span
                                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-opacity"
                                style={{
                                    background: item.color,
                                    opacity: active ? 1 : 0,
                                }}
                                aria-hidden
                            />

                            {/* Module color dot */}
                            <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-1"
                                style={{
                                    background: item.color,
                                    boxShadow: active ? `0 0 8px ${item.color}` : 'none',
                                    opacity: active ? 1 : 0.55,
                                }}
                            />

                            {/* Label */}
                            <span
                                className="flex-1 min-w-0 text-[12px] font-bold truncate"
                                style={{
                                    color: active ? item.color : 'var(--app-foreground)',
                                    letterSpacing: '-0.005em',
                                }}
                            >
                                {item.label}
                            </span>

                            {/* Counts: total + dirty pulse */}
                            <span className="inline-flex items-center gap-1.5 flex-shrink-0">
                                {item.dirty > 0 && (
                                    <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black tabular-nums"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-warning) 14%, transparent)',
                                            color: 'var(--app-warning)',
                                        }}
                                        title={`${item.dirty} unsaved`}
                                    >
                                        <span
                                            className="w-1 h-1 rounded-full animate-pulse"
                                            style={{ background: 'var(--app-warning)' }}
                                        />
                                        {item.dirty}
                                    </span>
                                )}
                                <span
                                    className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded"
                                    style={{
                                        background: active
                                            ? `color-mix(in srgb, ${item.color} 14%, transparent)`
                                            : 'color-mix(in srgb, var(--app-border) 35%, transparent)',
                                        color: active ? item.color : 'var(--app-muted-foreground)',
                                    }}
                                >
                                    {item.count}
                                </span>
                                <ChevronRight
                                    size={11}
                                    className="transition-transform"
                                    style={{
                                        color: active ? item.color : 'var(--app-muted-foreground)',
                                        opacity: active ? 1 : 0.4,
                                        transform: active ? 'translateX(1px)' : 'none',
                                    }}
                                />
                            </span>
                        </button>
                    )
                })}
            </nav>
        </aside>
    )
}
