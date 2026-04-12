'use client';

import {
    Package,
    ArrowDownCircle,
    ArrowUpCircle,
    DollarSign,
    History
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UniversalDataTable } from "@/components/ui/universal-data-table";
import { getInventoryMovementsUDLE, getInventoryMovementsMeta } from "@/app/actions/inventory";
import { useState, useEffect } from "react";

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}

export default function InventoryMovementsPage() {
    const [stats, setStats] = useState({ total: 0, in: 0, out: 0, value: 0 });

    // We can still calculate stats if needed, or fetch them from a separate endpoint.
    // For now, let's focus on the Universal List experience.

    return (
        <div className="p-6 space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-app-foreground flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <History size={28} className="text-white" />
                        </div>
                        Inventory <span className="text-indigo-600">Movements</span>
                    </h1>
                    <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Universal Dynamic List Engine Active</p>
                </div>
            </header>

            <UniversalDataTable
                endpoint="inventory/inventory-movements"
                fetcher={getInventoryMovementsUDLE}
                metaFetcher={getInventoryMovementsMeta}
                onRowClick={() => { }}
            />
        </div>
    );
}
