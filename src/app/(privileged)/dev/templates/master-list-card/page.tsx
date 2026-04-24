'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
    ArrowLeft, ShoppingCart, Package, Truck, FileText, CheckCircle2, AlertTriangle,
    Clock, User, Calendar, Pencil, Trash2, Plus, Ruler, GitBranch,
} from 'lucide-react'
import { MasterListCard } from '@/components/templates/MasterListCard'

export default function MasterListCardDemo() {
    const [selectedId, setSelectedId] = useState<string | null>('po-2')

    const examples = [
        {
            id: 'po-1',
            icon: <FileText size={13} />,
            accent: 'var(--app-muted-foreground)',
            title: 'PO-00021',
            subtitle: <>
                <span className="flex items-center gap-1"><User size={9} />Guerlain Wholesale</span>
                <span className="opacity-50">·</span>
                <span className="flex items-center gap-1"><Calendar size={9} />18 Apr 2026</span>
            </>,
            badges: [{ label: 'Draft', color: 'var(--app-muted-foreground)' }],
            right: <span className="font-bold tabular-nums">$ 2,400</span>,
        },
        {
            id: 'po-2',
            icon: <Clock size={13} />,
            accent: 'var(--app-warning)',
            title: 'PO-00022',
            subtitle: <>
                <span className="flex items-center gap-1"><User size={9} />Estée Lauder</span>
                <span className="opacity-50">·</span>
                <span className="flex items-center gap-1"><Calendar size={9} />20 Apr 2026</span>
            </>,
            badges: [{ label: 'Pending Approval', color: 'var(--app-warning)' }],
            right: <span className="font-bold tabular-nums">$ 14,900</span>,
        },
        {
            id: 'po-3',
            icon: <Truck size={13} />,
            accent: 'var(--app-error)',
            leftAccent: 'var(--app-error)',
            title: 'PO-00023',
            subtitle: <>
                <span className="flex items-center gap-1"><User size={9} />Chanel Distribution</span>
                <span className="opacity-50">·</span>
                <span className="flex items-center gap-1"><Calendar size={9} />22 Apr 2026</span>
            </>,
            badges: [
                { label: 'In Transit', color: 'var(--app-warning)' },
                { label: 'Urgent', color: 'var(--app-error)', icon: <AlertTriangle size={9} /> },
            ],
            right: <span className="font-bold tabular-nums">$ 38,150</span>,
        },
        {
            id: 'po-4',
            icon: <Package size={13} />,
            accent: 'var(--app-success)',
            title: 'PO-00024',
            subtitle: <>
                <span className="flex items-center gap-1"><User size={9} />L'Oréal Paris</span>
                <span className="opacity-50">·</span>
                <span className="flex items-center gap-1"><Calendar size={9} />23 Apr 2026</span>
            </>,
            badges: [{ label: 'Fully Received', color: 'var(--app-success)' }],
            right: <span className="font-bold tabular-nums">$ 9,200</span>,
        },
        {
            id: 'po-5',
            icon: <CheckCircle2 size={13} />,
            accent: 'var(--app-success)',
            title: 'PO-00025',
            subtitle: <>
                <span className="flex items-center gap-1"><User size={9} />Dior Beauty</span>
                <span className="opacity-50">·</span>
                <span className="flex items-center gap-1"><Calendar size={9} />24 Apr 2026</span>
            </>,
            badges: [{ label: 'Completed', color: 'var(--app-success)' }],
            right: <span className="font-bold tabular-nums">$ 21,450</span>,
        },
    ]

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
                <Link href="/dev/templates"
                    className="p-2 rounded-xl transition-all"
                    style={{
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    }}>
                    <ArrowLeft size={14} />
                </Link>
                <div>
                    <h1 className="text-lg font-black text-app-foreground tracking-tight">MasterListCard</h1>
                    <p className="text-tp-xs text-app-muted-foreground">
                        Dumb-props card primitive — same grammar as the KPI filter chips in TreeMasterPage.
                    </p>
                </div>
            </div>

            {/* Scenario 1 — PO-style rows mapped to MasterListCard */}
            <section className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-tp-md font-bold text-app-foreground">Variants in one list</h2>
                    <span className="text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-full"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                        click to select
                    </span>
                </div>
                <p className="text-tp-xs text-app-muted-foreground mb-3">
                    One row per status — draft, pending, urgent, received, completed. Left-accent bar shows on urgent.
                </p>
                <div className="rounded-2xl overflow-hidden"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    {examples.map(e => (
                        <MasterListCard key={e.id}
                            icon={e.icon}
                            accentColor={e.accent}
                            leftAccent={e.leftAccent as any}
                            title={e.title}
                            subtitle={e.subtitle}
                            badges={e.badges as any}
                            rightSlot={e.right}
                            isSelected={selectedId === e.id}
                            onClick={() => setSelectedId(e.id)}
                            actions={
                                <>
                                    <button className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground">
                                        <Pencil size={12} />
                                    </button>
                                    <button className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-error">
                                        <Trash2 size={12} />
                                    </button>
                                </>
                            }
                        />
                    ))}
                </div>
            </section>

            {/* Scenario 2 — density compact + different icons */}
            <section className="mb-6">
                <h2 className="text-tp-md font-bold text-app-foreground mb-1">Compact density + different icons</h2>
                <p className="text-tp-xs text-app-muted-foreground mb-3">
                    Same primitive used for taxonomies — Units, Warehouses, Categories.
                </p>
                <div className="rounded-2xl overflow-hidden"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    <MasterListCard
                        density="compact"
                        icon={<Ruler size={13} />}
                        accentColor="var(--app-info)"
                        title="Kilogram"
                        subtitle="Weight · Base unit · 12 products"
                        badges={[{ label: 'Weight', color: 'var(--app-info)' }]}
                        rightSlot={<span className="text-tp-xs font-bold text-app-muted-foreground">KG</span>}
                    />
                    <MasterListCard
                        density="compact"
                        icon={<GitBranch size={13} />}
                        accentColor="var(--app-success)"
                        title="Main Branch"
                        subtitle="Beirut · Lebanon"
                        badges={[
                            { label: 'Branch', color: 'var(--app-success)' },
                            { label: 'POS', color: 'var(--app-success)' },
                        ]}
                        rightSlot={<span className="text-tp-xs font-bold text-app-muted-foreground tabular-nums">1,204 SKUs</span>}
                    />
                    <MasterListCard
                        density="compact"
                        icon={<Package size={13} />}
                        accentColor="var(--app-warning)"
                        title="Pack of 6"
                        subtitle="× 6 PC · Packaging template"
                        badges={[{ label: 'Default', color: 'var(--app-warning)' }]}
                        rightSlot={<Plus size={13} className="text-app-muted-foreground" />}
                    />
                </div>
            </section>

            {/* Scenario 3 — minimal */}
            <section>
                <h2 className="text-tp-md font-bold text-app-foreground mb-1">Minimal (title + right only)</h2>
                <p className="text-tp-xs text-app-muted-foreground mb-3">
                    Every prop is optional except title. Leave out the icon / subtitle / badges.
                </p>
                <div className="rounded-2xl overflow-hidden"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    <MasterListCard title="No icon, no subtitle" rightSlot={<span className="text-tp-xxs text-app-muted-foreground">→</span>} />
                    <MasterListCard title="No icon, with subtitle" subtitle="Metadata only" />
                </div>
            </section>
        </div>
    )
}
