import { getFinancialDashboardStats } from '@/app/actions/finance/dashboard';
import FinanceDashboardViewer from '@/app/(privileged)/finance/dashboard/viewer';
import { cookies } from 'next/headers';
import { Wallet, RefreshCw } from 'lucide-react';

export default async function FinanceDashboardPage() {
 const cookieStore = await cookies();
 const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL';
 let stats: any = {};
 try { stats = await getFinancialDashboardStats(scope); } catch { /* fallback */ }

 return (
 <div
 className="app-page min-h-screen p-5 md:p-6 space-y-5 max-w-7xl mx-auto bg-app-background"
 style={{ color: 'var(--app-foreground)' }}
 >
 {/* ── Header ────────────────────────────── */}
 <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 fade-in-up">
 <div className="flex items-center gap-4">
 <div
 className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
 style={{ background: 'var(--app-primary)', boxShadow: '0 8px 24px var(--app-primary-glow)' }}
 >
 <Wallet size={30} color="#fff" />
 </div>
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span
 className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
 style={{
 background: 'var(--app-primary)/10',
 color: 'var(--app-primary)',
 border: '1px solid var(--app-primary-glow)',
 }}
 >
 Finances: Active
 </span>
 <span
 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
 style={{ color: 'var(--app-muted-foreground)' }}
 >
 <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
 Ledger Sync: Real-time
 </span>
 </div>
 <h1
 className="text-3xl font-black tracking-tight"
 style={{ color: 'var(--app-foreground)' }}
 >
 Financial <span style={{ color: 'var(--app-primary)' }}>Intelligence</span>
 </h1>
 <p className="text-sm mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
 Comprehensive monetary oversight and multi-ledger forensic analytics.
 </p>
 </div>
 </div>
 <div
 className="hidden lg:flex items-center gap-2 px-4 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest"
 style={{
 background: 'var(--app-surface)',
 border: '1px solid var(--app-border)',
 color: 'var(--app-muted-foreground)',
 }}
 >
 <span style={{ color: 'var(--app-primary)' }}>⬤</span>
 {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 </div>
 </header>

 {/* ── Finance Dashboard Viewer ──────────── */}
 <FinanceDashboardViewer initialStats={JSON.parse(JSON.stringify(stats))} />
 </div>
 );
}