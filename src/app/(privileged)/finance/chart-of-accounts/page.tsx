import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { ChartOfAccountsViewer } from './viewer'
import { cookies } from 'next/headers'
import { BookOpen, ShieldCheck } from 'lucide-react'
import { Badge } from "@/components/ui/badge"

export default async function ChartOfAccountsPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
    let accounts: any = []
    try { accounts = await getChartOfAccounts(true, scope) } catch { /* empty fallback */ }

    return (
        <div className="p-6 space-y-6">
            <header className="flex justify-between items-end mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                            Node: Accounts Explorer
                        </Badge>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1">
                            <ShieldCheck size={12} /> Double-Entry Enforced
                        </span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-200">
                            <BookOpen size={32} className="text-white" />
                        </div>
                        Chart of <span className="text-emerald-600">Accounts</span>
                    </h1>
                </div>
            </header>
            <ChartOfAccountsViewer accounts={JSON.parse(JSON.stringify(accounts))} />
        </div>
    )
}