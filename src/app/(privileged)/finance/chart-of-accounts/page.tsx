import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { ChartOfAccountsViewer } from './viewer'
import { cookies } from 'next/headers'
import { BookOpen } from 'lucide-react'

export default async function ChartOfAccountsPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
    let accounts: any = []
    try { accounts = await getChartOfAccounts(true, scope) } catch { /* empty fallback */ }

    return (
        <div className="p-6 space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <BookOpen size={28} className="text-white" />
                        </div>
                        Chart of <span className="text-emerald-600">Accounts</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">General Ledger Structure</p>
                </div>
            </header>
            <ChartOfAccountsViewer accounts={JSON.parse(JSON.stringify(accounts))} />
        </div>
    )
}