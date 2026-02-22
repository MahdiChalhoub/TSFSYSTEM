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
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-end mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                            System Node: Active
                        </Badge>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1">
                            <RefreshCw size={12} className="animate-spin-slow" /> Sync: Real-time
                        </span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-200">
                            <Wallet size={32} className="text-white" />
                        </div>
                        Finance <span className="text-indigo-600">Overview</span>
                    </h1>
                </div>
                <div className="bg-stone-50 border border-stone-200 px-4 py-2 rounded-xl text-xs font-bold text-stone-400 uppercase tracking-widest">
                    Node: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </header>

            <FinanceDashboardViewer initialStats={JSON.parse(JSON.stringify(stats))} />
        </div>
    )
}