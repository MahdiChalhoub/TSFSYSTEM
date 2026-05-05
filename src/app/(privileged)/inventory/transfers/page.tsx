'use client';

import { ArrowRightLeft } from 'lucide-react';
import { UniversalDataTable } from '@/components/ui/universal-data-table';
import { getTransfersUDLE, getTransfersMeta } from '@/app/actions/inventory/transfers';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function StockTransfersPage() {
 const router = useRouter();

 return (
 <div
 className="app-page min-h-screen p-5 md:p-6 space-y-5 max-w-7xl mx-auto bg-app-background"
 style={{ color: 'var(--app-foreground)' }}
 >
 {/* ── Header ────────────────────────────── */}
 <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 fade-in-up">
 <div className="flex items-center gap-4">
 <div
 className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
 style={{ background: 'var(--app-primary)', boxShadow: '0 8px 24px var(--app-primary-glow)' }}
 >
 <ArrowRightLeft size={26} color="#fff" />
 </div>
 <div>
 <h1 style={{ color: 'var(--app-foreground)' }}>
 Stock <span style={{ color: 'var(--app-primary)' }}>Transfers</span>
 </h1>
 <p className="text-sm mt-0.5 uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
 Multi-Warehouse Operations
 </p>
 </div>
 </div>

 <div className="flex items-center gap-3">
 <Link href="/inventory/transfers/new">
 <Button className="bg-app-primary hover:bg-app-success text-app-primary-foreground rounded-xl shadow-lg shadow-emerald-200">
 New Transfer
 </Button>
 </Link>
 </div>
 </header>

 {/* ── Data Table ────────────────────────── */}
 <UniversalDataTable
 endpoint="inventory/stock-moves"
 fetcher={getTransfersUDLE}
 metaFetcher={getTransfersMeta}
 onRowClick={(row) => {
 if (row.id) {
 router.push(`/inventory/transfers/${row.id}`);
 }
 }}
 />
 </div>
 );
}
