import { getAccountStatement } from '@/app/actions/finance/accounts'
import AccountStatementView from './statement'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function AccountStatementPage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>,
    searchParams: Promise<{ start?: string, end?: string }>
}) {
    const resolvedParams = await params
    const resolvedSearchParams = await searchParams

    const accountId = parseInt(resolvedParams.id)

    // Default Range: Current Month
    const now = new Date()
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const startDate = resolvedSearchParams.start ? new Date(resolvedSearchParams.start) : new Date(defaultStart)
    const endDate = resolvedSearchParams.end ? new Date(resolvedSearchParams.end) : new Date(defaultEnd)

    const data = await getAccountStatement(accountId, {
        startDate,
        endDate
    })

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <Link href="/admin/finance/chart-of-accounts" className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-900 mb-6 font-medium text-sm">
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
