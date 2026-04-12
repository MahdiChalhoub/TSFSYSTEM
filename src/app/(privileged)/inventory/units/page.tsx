import { erpFetch } from "@/lib/erp-api";
import { UnitTree } from "@/components/admin/UnitTree";
import { CreateUnitButton } from "@/components/admin/CreateUnitButton";
import { UnitCalculator } from "@/components/admin/UnitCalculator";
import { Ruler, ArrowLeftRight } from 'lucide-react';
import NextLink from 'next/link';

export const dynamic = 'force-dynamic';

async function getUnitsData() {
    try {
        const units = await erpFetch('units/');
        const mappedUnits = units.map((u: Record<string, any>) => ({
            ...u,
            _count: { products: u.product_count || 0 }
        }));

        const unitMap = new Map();
        const roots: Record<string, any>[] = [];

        mappedUnits.forEach((u: Record<string, any>) => {
            unitMap.set(u.id, { ...u, children: [] });
        });

        mappedUnits.forEach((u: Record<string, any>) => {
            const node = unitMap.get(u.id);
            if (u.baseUnitId) {
                const parent = unitMap.get(u.baseUnitId);
                if (parent) parent.children.push(node);
                else roots.push(node);
            } else {
                roots.push(node);
            }
        });

        return {
            hierarchicalUnits: JSON.parse(JSON.stringify(roots)),
            flatUnits: JSON.parse(JSON.stringify(mappedUnits))
        };
    } catch (e) {
        console.error("Failed to fetch units:", e);
        return { hierarchicalUnits: [], flatUnits: [] };
    }
}

export default async function UnitsPage() {
    const { hierarchicalUnits, flatUnits } = await getUnitsData();

    const totalUnits = flatUnits.length;
    const baseUnits = hierarchicalUnits.length;
    const totalProducts = flatUnits.reduce((sum: number, u: Record<string, any>) => sum + (u.product_count || u._count?.products || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* V2 Icon-Box Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 fade-in-up">
                <div className="flex items-center gap-4">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                            background: 'var(--app-primary-bg, color-mix(in srgb, var(--app-primary) 10%, transparent))',
                            border: '1px solid var(--app-primary-border, color-mix(in srgb, var(--app-primary) 20%, transparent))',
                        }}
                    >
                        <Ruler size={26} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                            Inventory / Taxonomy
                        </p>
                        <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                            Units & Packaging
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                            Define base units (Piece, KG) and packaging hierarchies (Box = 12 Pieces).
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <NextLink
                        href="/inventory/maintenance?tab=unit"
                        className="px-4 py-2.5 rounded-xl font-bold text-[12px] flex items-center gap-2 transition-all"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-text)',
                        }}
                    >
                        <ArrowLeftRight size={16} />
                        Reorganize
                    </NextLink>
                    <CreateUnitButton potentialParents={flatUnits} />
                </div>
            </header>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Units', value: totalUnits },
                    { label: 'Base Units', value: baseUnits },
                    { label: 'Linked Products', value: totalProducts },
                ].map(kpi => (
                    <div key={kpi.label} className="p-4 rounded-xl" style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                    }}>
                        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>{kpi.label}</p>
                        <p className="text-2xl font-black mt-1" style={{ color: 'var(--app-text)' }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Content */}
            <div className="p-5 rounded-2xl" style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
            }}>
                <div className="flex justify-between items-center mb-5 pb-4" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <h3 className="text-lg font-black" style={{ color: 'var(--app-text)' }}>Unit Hierarchies</h3>
                    <input
                        type="text"
                        placeholder="Search units..."
                        className="px-4 py-2 rounded-xl text-[12px] w-64 transition-all outline-none"
                        style={{
                            background: 'var(--app-bg)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-text)',
                        }}
                    />
                </div>

                {hierarchicalUnits.length > 0 ? (
                    <UnitTree units={hierarchicalUnits} potentialParents={flatUnits} />
                ) : (
                    <div className="py-12 text-center" style={{ color: 'var(--app-text-muted)' }}>
                        <p>No units defined yet.</p>
                    </div>
                )}
            </div>

            <UnitCalculator units={flatUnits} />
        </div>
    );
}