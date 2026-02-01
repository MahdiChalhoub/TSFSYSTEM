import { getJournalEntry } from '@/app/actions/finance/ledger'
import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { prisma } from '@/lib/db'
import JournalEntryForm from '../../new/form'
import { notFound } from 'next/navigation'

export default async function EditJournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const entryId = parseInt(id)
    if (isNaN(entryId)) notFound()

    const entry = await getJournalEntry(entryId)
    if (!entry) notFound()

    if (entry.status === 'REVERSED') {
        return (
            <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-lg max-w-2xl mx-auto mt-12">
                <h1 className="text-xl font-bold text-rose-800">Cannot Edit Reversed Entry</h1>
                <p className="text-rose-600 mt-2">Reversed transactions are immutable. To correct this, create a new manual entry.</p>
                <a href="/admin/finance/ledger" className="mt-4 inline-block text-rose-800 font-bold underline">Back to Ledger</a>
            </div>
        )
    }

    const accounts = await getChartOfAccounts()
    const fiscalYears = await prisma.fiscalYear.findMany({
        include: { periods: true }
    })

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold text-stone-900 font-serif mb-8">Edit Journal Voucher #{entry.id}</h1>
            <JournalEntryForm
                accounts={JSON.parse(JSON.stringify(accounts))}
                fiscalYears={JSON.parse(JSON.stringify(fiscalYears))}
                initialEntry={JSON.parse(JSON.stringify(entry))}
            />
        </div>
    )
}
