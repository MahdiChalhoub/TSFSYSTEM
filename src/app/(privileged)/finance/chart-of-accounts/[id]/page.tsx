import { getAccountStatement } from '@/app/actions/finance/accounts'
import AccountStatementView from './statement'
import Link from 'next/link'
import { ArrowLeft , BookOpen} from 'lucide-react'

import { cookies } from 'next/headers'

export default async function AccountStatementPage({
 params,
 searchParams
}: {
 params: Promise<{ id: string }>,
 searchParams: Promise<{ start?: string, end?: string }>
}) {
 const cookieStore = await cookies()
 const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'

 const resolvedParams = await params
 const resolvedSearchParams = await searchParams

 const accountId = parseInt(resolvedParams.id)

 // Default Range: Current Month
 const now = new Date()
 const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
 const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

 const startDate = resolvedSearchParams.start ? new Date(resolvedSearchParams.start) : new Date(defaultStart)
 const endDate = resolvedSearchParams.end ? new Date(resolvedSearchParams.end) : new Date(defaultEnd)

 let data: any = { account: {}, openingBalance: 0, lines: [] }
 try {
 data = await getAccountStatement(accountId, { startDate, endDate }, scope)
 } catch { /* graceful fallback */ }

 return (
 <div className="app-page p-6 max-w-5xl mx-auto">
  {/* V2 Header */}
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 fade-in-up">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-primary)20', border: `1px solid ${color}40` }}>
        <BookOpen size={26} style={{ color: 'var(--app-primary)' }} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Management</p>
        <h1 className="text-3xl font-black tracking-tight text-app-foreground">Account Detail</h1>
        <p className="text-sm text-app-muted-foreground mt-0.5">Chart of account details and ledger</p>
      </div>
    </div>
  </header>
 <Link href="/finance/chart-of-accounts" className="inline-flex items-center gap-2 text-app-muted-foreground hover:text-app-foreground mb-6 font-medium text-sm">
 <ArrowLeft size={16} /> Back to Chart of Accounts
 </Link>

 <AccountStatementView
 data={data}
 dateRange={{
 start: startDate.toISOString().split('T')[0],
 end: endDate.toISOString().split('T')[0]
 }}
 />
 </div>
 )
}