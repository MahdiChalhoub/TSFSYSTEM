'use client';

import { History } from 'lucide-react';
import { UniversalDataTable } from '@/components/ui/universal-data-table';
import { getInventoryMovementsUDLE, getInventoryMovementsMeta } from '@/app/actions/inventory';

export default function InventoryMovementsPage() {
 return (
 <div
 className="app-page min-h-screen p-5 md:p-6 space-y-5 max-w-7xl mx-auto bg-app-background"
 style={{ color: 'var(--app-foreground)' }}
 >
 {/* ── Header ────────────────────────────── */}
 <header className="flex items-center gap-4 fade-in-up">
 <div
 className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
 style={{ background: 'var(--app-primary)', boxShadow: '0 8px 24px var(--app-primary-glow)' }}
 >
 <History size={26} color="#fff" />
 </div>
 <div>
 <h1
 className="text-3xl font-black tracking-tight"
 style={{ color: 'var(--app-foreground)' }}
 >
 Inventory <span style={{ color: 'var(--app-primary)' }}>Movements</span>
 </h1>
 <p className="text-sm mt-0.5 uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
 Universal Dynamic List Engine Active
 </p>
 </div>
 </header>

 {/* ── Data Table ────────────────────────── */}
 <UniversalDataTable
 endpoint="inventory/inventory-movements"
 fetcher={getInventoryMovementsUDLE}
 metaFetcher={getInventoryMovementsMeta}
 onRowClick={() => { }}
 />
 </div>
 );
}
