import { erpFetch } from "@/lib/erp-api";
import { UnitTree } from "@/components/admin/UnitTree";
import { CreateUnitButton } from "@/components/admin/CreateUnitButton";
import { UnitCalculator } from "@/components/admin/UnitCalculator";
import { Ruler } from 'lucide-react';
import NextLink from 'next/link';

export const dynamic = 'force-dynamic';

async function getUnitsData() {
    try {
        const units = await erpFetch('units/');

        // Map backend response if needed (UnitSerializer has product_count)
        // Build Tree
        const unitMap = new Map();
        const roots: Record<string, any>[] = [];

        // Initialize Map
        units.forEach((u: Record<string, any>) => {
            unitMap.set(u.id, {
                ...u,
                children: [],
                product_count: u.product_count || 0
            });
        });

        // Link Children to Parents
        units.forEach((u: Record<string, any>) => {
            const node = unitMap.get(u.id);
            const parentId = u.base_unit; // Backend field is base_unit
            if (parentId) {
                const parent = unitMap.get(parentId);
                if (parent) {
                    parent.children.push(node);
                } else {
                    // If parent missing, treat as root (fallback)
                    roots.push(node);
                }
            } else {
                roots.push(node);
            }
        });

        // We also return the flat list for the generic "Create" dropdown
        return {
            hierarchicalUnits: roots,
            flatUnits: units
        };
    } catch (e) {
        console.error("Failed to fetch units:", e);
        return { hierarchicalUnits: [], flatUnits: [] };
    }
}

export default async function UnitsPage() {
    const { hierarchicalUnits, flatUnits } = await getUnitsData();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Units & Packaging</h1>
                    <p className="text-gray-500">Define base units (Piece, KG) and packaging hierarchies (Box = 12 Pieces).</p>
                </div>
                <div className="flex gap-3">
                    <NextLink
                        href="/inventory/maintenance?tab=unit"
                        className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-emerald-600 px-4 py-3 rounded-xl font-semibold shadow-sm transition-all flex items-center gap-2"
                    >
                        <Ruler size={20} />
                        <span>Reorganize</span>
                    </NextLink>
                    <CreateUnitButton potentialParents={flatUnits} />
                </div>
            </div>

            {/* Content */}
            <div className="card-premium p-6">
                {/* Tree Header */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-800">Unit Hierarchies</h3>
                    <input
                        type="text"
                        placeholder="Search units..."
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 w-64 transition-all"
                    />
                </div>

                {hierarchicalUnits.length > 0 ? (
                    <UnitTree units={hierarchicalUnits as any[]} potentialParents={flatUnits as any[]} />
                ) : (
                    <div className="py-12 text-center text-gray-400">
                        <p>No units defined yet.</p>
                    </div>
                )}
            </div>

            {/* Quick Calculator (Bonus) */}
            <UnitCalculator units={flatUnits} />
        </div>
    );
}