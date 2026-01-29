import { prisma } from "@/lib/db";
import { UnitTree } from "@/components/admin/UnitTree";
import { Unit } from "@prisma/client";
import { CreateUnitButton } from "@/components/admin/CreateUnitButton";
import { UnitCalculator } from "@/components/admin/UnitCalculator";
import { Link } from "lucide-react"; // Wait, Link is next/link. Lucide has Link icon too? No, use Ruler.
import { Ruler } from 'lucide-react';
import NextLink from 'next/link';

export const dynamic = 'force-dynamic';

async function getUnitsData() {
    const units = await prisma.unit.findMany({
        include: {
            _count: {
                select: { products: true }
            }
        },
        orderBy: { id: 'asc' }
    });

    // Build Tree
    const unitMap = new Map();
    const roots: any[] = [];

    // Initialize Map with empty children array
    units.forEach((u: Unit) => {
        unitMap.set(u.id, { ...u, children: [] });
    });

    // Link Children to Parents
    units.forEach((u: Unit) => {
        const node = unitMap.get(u.id);
        if (u.baseUnitId) {
            const parent = unitMap.get(u.baseUnitId);
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
    // Plain serialization to handle decimals
    return {
        hierarchicalUnits: JSON.parse(JSON.stringify(roots)),
        flatUnits: JSON.parse(JSON.stringify(units))
    };
}

export default async function UnitsPage() {
    const { hierarchicalUnits, flatUnits } = await getUnitsData();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Units & Packaging</h1>
                    <p className="text-gray-500">Define base units (Piece, KG) and packaging hierarchies (Box = 12 Pieces).</p>
                </div>
                <div className="flex gap-3">
                    <NextLink
                        href="/admin/inventory/maintenance?tab=unit"
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
                    <UnitTree units={hierarchicalUnits} potentialParents={flatUnits} />
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
