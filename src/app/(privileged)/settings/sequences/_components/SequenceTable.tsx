'use client'

import {
    DOCUMENT_GROUPS, TIERS, MASTER_DATA_GROUPS,
    DEFAULT_PREFIXES, resolveSeqKey,
} from '../_lib/constants'
import type { Sequence, TabKey } from '../_lib/types'
import { SequenceRow } from './SequenceRow'

interface SequenceTableProps {
    tab: TabKey
    sequences: Sequence[]
    dirtyKeys: Set<string>
    onChange: (seqKey: string, field: keyof Sequence, value: string | number) => void
}

function getSeq(sequences: Sequence[], docType: string, tier: string): Sequence {
    const key = resolveSeqKey(docType, tier)
    return sequences.find(s => s.type === key) ?? {
        type: key,
        prefix: DEFAULT_PREFIXES[docType]?.[tier] || `${docType.slice(0, 3)}-`,
        suffix: '', next_number: 1, padding: 6,
    }
}

function getMasterSeq(sequences: Sequence[], id: string, dp: string): Sequence {
    return sequences.find(s => s.type === id) ?? {
        type: id, prefix: dp, suffix: '', next_number: 1, padding: 5,
    }
}

// ── Column headers ───────────────────────────────────────────
function ColumnHeader({ hasTier }: { hasTier: boolean }) {
    return (
        <div className="flex items-center gap-2 md:gap-3 px-3 py-1.5 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}
        >
            <div className="w-[130px] flex-shrink-0">Entity</div>
            {hasTier && <div className="w-[80px] flex-shrink-0">Tier</div>}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="w-[72px]">Prefix</span>
                <span className="w-[64px]">Next #</span>
                <span className="w-[48px]">Pad</span>
                <span className="w-[56px]">Suffix</span>
            </div>
            <div className="flex-shrink-0 text-right">Preview</div>
        </div>
    )
}

// ── Module header ────────────────────────────────────────────
function ModuleHeader({ label, color, count }: { label: string; color: string; count: number }) {
    return (
        <div
            className="flex items-center gap-2.5 px-3 py-2"
            style={{
                background: `color-mix(in srgb, ${color} 5%, var(--app-surface))`,
                borderBottom: `1px solid color-mix(in srgb, ${color} 15%, transparent)`,
            }}
        >
            <div className="w-1 h-4 rounded-full" style={{ background: color }} />
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color }}>
                {label}
            </span>
            <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
                {count}
            </span>
        </div>
    )
}

// ── Tier badge ───────────────────────────────────────────────
function TierBadge({ tier }: { tier: typeof TIERS[number] }) {
    return (
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md"
            style={{
                background: `color-mix(in srgb, ${tier.color} 10%, transparent)`,
                color: tier.color,
            }}
            title={tier.desc}
        >
            <tier.icon size={9} />
            <span className="text-[9px] font-black uppercase">{tier.label}</span>
        </div>
    )
}

// ── Main component ───────────────────────────────────────────
export function SequenceTable({ tab, sequences, dirtyKeys, onChange }: SequenceTableProps) {
    if (tab === 'documents') {
        return (
            <div className="space-y-3">
                {DOCUMENT_GROUPS.map(group => (
                    <div key={group.module}
                        className="rounded-2xl border border-app-border/50 overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                        <ModuleHeader label={group.module} color={group.color} count={group.items.length} />
                        <ColumnHeader hasTier />
                        {group.items.map((dt, di) => (
                            <div key={dt.id}>
                                {di > 0 && <div className="h-px mx-3" style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }} />}
                                {TIERS.map((tier, ti) => (
                                    <SequenceRow
                                        key={resolveSeqKey(dt.id, tier.key)}
                                        seqKey={resolveSeqKey(dt.id, tier.key)}
                                        seq={getSeq(sequences, dt.id, tier.key)}
                                        label={ti === 0 ? dt.label : ''}
                                        labelIcon={ti === 0 ? <dt.icon size={14} /> : undefined}
                                        labelColor={dt.color}
                                        tierBadge={<TierBadge tier={tier} />}
                                        isDirty={dirtyKeys.has(resolveSeqKey(dt.id, tier.key))}
                                        onChange={onChange}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {MASTER_DATA_GROUPS.map(group => (
                <div key={group.module}
                    className="rounded-2xl border border-app-border/50 overflow-hidden"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                    <ModuleHeader label={group.module} color={group.color} count={group.items.length} />
                    <ColumnHeader hasTier={false} />
                    {group.items.map((ent, i) => (
                        <div key={ent.id}>
                            {i > 0 && <div className="h-px mx-3" style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }} />}
                            <SequenceRow
                                seqKey={ent.id}
                                seq={getMasterSeq(sequences, ent.id, ent.defaultPrefix)}
                                label={ent.label}
                                labelIcon={<ent.icon size={14} />}
                                labelColor={ent.color}
                                isDirty={dirtyKeys.has(ent.id)}
                                onChange={onChange}
                            />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    )
}
