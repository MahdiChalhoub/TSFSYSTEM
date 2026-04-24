import Link from 'next/link'
import { LayoutGrid, BookMarked, Package, ListTree, GitBranch } from 'lucide-react'

export const dynamic = 'force-dynamic'

const DEMOS = [
    {
        href: '/dev/templates/master-list-card',
        title: 'MasterListCard',
        kind: 'Primitive',
        icon: LayoutGrid,
        color: 'var(--app-primary)',
        blurb: 'Shared list-row card used by PurchaseOrderRow. Same visual grammar as the KPI filter chips in TreeMasterPage — icon tile + title + badges + subtitle + right slot + hover actions.',
        lines: 157,
    },
    {
        href: '/dev/templates/tree-master',
        title: 'TreeMasterPage',
        kind: 'Page shell',
        icon: GitBranch,
        color: 'var(--app-success)',
        blurb: 'Desktop page shell used by Units, Categories, Packages, Attributes, Countries, Warehouses, Purchases. Owns search, KPI filter, tree build, split panel, pinned sidebar, focus mode.',
        lines: 574,
    },
    {
        href: '/dev/templates/entity-products-tab',
        title: 'EntityProductsTab',
        kind: 'Tab component',
        icon: Package,
        color: 'var(--app-warning)',
        blurb: 'Drop-in "Products of this entity" tab. Server-side search, infinite scroll, sort, multi-select, move-between-entities modal, preview popup.',
        lines: 675,
    },
]

export default function TemplatesIndexPage() {
    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-2">
                <div className="page-header-icon bg-app-primary"
                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                    <BookMarked size={20} className="text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-app-foreground tracking-tight">Template Showcase</h1>
                    <p className="text-tp-sm text-app-muted-foreground">
                        Interactive previews of the shared building blocks under <code className="font-mono">components/templates/</code>.
                    </p>
                </div>
            </div>

            <div className="mt-6 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                {DEMOS.map(d => (
                    <Link key={d.href} href={d.href}
                        className="group rounded-2xl p-4 transition-all hover:scale-[1.01] hover:shadow-md"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{
                                    background: `color-mix(in srgb, ${d.color} 14%, transparent)`,
                                    color: d.color,
                                }}>
                                <d.icon size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: d.color }}>{d.kind}</p>
                                <p className="text-tp-md font-bold text-app-foreground truncate">{d.title}</p>
                            </div>
                            <span className="ml-auto text-tp-xxs font-mono font-bold text-app-muted-foreground tabular-nums">
                                {d.lines}L
                            </span>
                        </div>
                        <p className="text-tp-sm text-app-muted-foreground leading-relaxed">{d.blurb}</p>
                        <p className="mt-3 text-tp-xs font-bold text-app-primary group-hover:underline">
                            Open preview →
                        </p>
                    </Link>
                ))}
            </div>

            <div className="mt-6 px-4 py-3 rounded-xl text-tp-xs text-app-muted-foreground"
                style={{
                    background: 'color-mix(in srgb, var(--app-info) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-info) 25%, transparent)',
                }}>
                <strong style={{ color: 'var(--app-info)' }}>Heads up:</strong> these pages render with synthetic data
                so you can see the templates in isolation without hitting real backend records.
                <span className="mx-1.5" style={{ color: 'var(--app-border)' }}>·</span>
                The EntityProductsTab demo is the exception — it points at a live <code className="font-mono">units/</code> endpoint
                so you can pick any real unit to see it populated.
            </div>
        </div>
    )
}
