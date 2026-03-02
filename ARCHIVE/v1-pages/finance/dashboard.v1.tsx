import { getFinancialDashboardStats } from '@/app/actions/finance/dashboard'
import FinanceDashboardViewer from '@/app/(privileged)/finance/dashboard/viewer'
import { cookies } from 'next/headers'
import { Badge } from "@/components/ui/badge"
import { Wallet, RefreshCw } from "lucide-react"

export default async function FinanceDashboardPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
    let stats: any = {}
    try { stats = await getFinancialDashboardStats(scope) } catch { /* empty fallback */ }

    return (
        <div className="page-container animate-in fade-in duration-700">
            <header className="flex flex-col gap-8 mb-10">
                <div className="flex justify-between items-end">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-[2rem] bg-emerald-gradient flex items-center justify-center shadow-2xl shadow-emerald-700/20 group hover:rotate-12 transition-transform duration-500">
                            <Wallet size={40} className="text-white fill-white/20" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full">
                                    Finances: Active
                                </Badge>
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <RefreshCw size={14} className="text-emerald-400 animate-spin-slow" /> Ledger Sync: Real-time
                                </span>
                            </div>
                            <h1 className="page-header-title">
                                Financial <span className="text-emerald-700">Intelligence</span>
                            </h1>
                            <p className="page-header-subtitle mt-1">
                                Comprehensive monetary oversight and multi-ledger forensic analytics.
                            </p>
                        </div>
                    </div>
                    <div className="hidden lg:flex items-center gap-4">
                        <div className="h-14 px-6 rounded-2xl bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                            Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
            </header>

            <FinanceDashboardViewer initialStats={JSON.parse(JSON.stringify(stats))} />
        </div>
    )
}