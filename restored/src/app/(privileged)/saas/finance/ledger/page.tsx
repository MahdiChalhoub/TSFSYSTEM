import { getLedgerEntries } from '@/app/actions/finance/ledger'
import { LedgerEntryActions } from './ledger-actions'
import Link from 'next/link'

import { cookies } from 'next/headers'

export default async function GeneralLedgerPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
    const entries = await getLedgerEntries(scope)

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold text-stone-900 font-serif">General Ledger</h1>
                        <span className="bg-emerald-50 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full border border-emerald-100 font-bold uppercase tracking-wider flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            Trial Balance Guard Active
                        </span>
                    </div>
                    <p className="text-sm text-stone-500">Review and manage your financial transactions with strict double-entry validation.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/admin/finance/ledger/opening/list" className="bg-white text-stone-600 border border-stone-200 px-5 py-2.5 rounded-lg hover:bg-stone-50 font-bold text-sm shadow-sm transition-all flex items-center gap-2">
                        ≡ƒôï Opening Balances
                    </Link>
                    <Link href="/admin/finance/ledger/new" className="bg-black text-white px-5 py-2.5 rounded-lg hover:bg-stone-800 font-bold text-sm shadow-sm transition-all flex items-center gap-2">
                        + New Journal Entry
                    </Link>
                </div>
            </div>

            <div className="space-y-4">
                {entries.map((entry: any) => {
                    const isLocked = entry.fiscalYear.status === 'LOCKED' || entry.fiscalYear.isLocked

                    return (
                        <div key={entry.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all border-stone-200 ${entry.status === 'REVERSED' ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                            {/* Header */}
                            <div className="p-4 bg-stone-50 border-b border-stone-100 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusStyle(entry.status)}`}>
                                        {entry.status}
                                    </div>
                                    <h3 className="font-bold text-stone-900 text-sm">JV #{entry.id} ΓÇö {entry.description}</h3>
                                </div>
                                <LedgerEntryActions
                                    entryId={entry.id}
                                    status={entry.status}
                                    isLocked={isLocked}
                                />
                            </div>

                            {/* Info Bar */}
                            <div className="px-4 py-2 bg-white flex items-center gap-6 text-[11px] text-stone-500 border-b border-stone-50 font-medium">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-stone-300">Date:</span> {entry.transactionDate.toLocaleDateString('en-GB')}
                                </div>
                                {entry.reference && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-stone-300">Ref:</span> <span className="font-mono text-stone-800">{entry.reference}</span>
                                    </div>
                                )}
                                {entry.reversalOf && (
                                    <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                                        <span>Γå║ Reversal of JV #{entry.reversalOf.id}</span>
                                    </div>
                                )}
                                {entry.reversedBy && (
                                    <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                                        <span>ΓÜá Reversed by JV #{entry.reversedBy.id}</span>
                                    </div>
                                )}
                            </div>

                            {/* Lines */}
                            <div className="p-4 pb-2">
                                <div className="space-y-1">
                                    {entry.lines.map((line: any) => (
                                        <div key={line.id} className="grid grid-cols-12 gap-3 py-1 items-center border-b border-stone-50 last:border-0 group">
                                            <div className="col-span-1 font-mono text-[10px] text-stone-400">
                                                {line.account.code}
                                            </div>
                                            <div className="col-span-5 text-xs font-medium text-stone-700">
                                                {line.account.name}
                                            </div>
                                            <div className="col-span-3 text-right text-xs font-mono text-stone-900">
                                                {Number(line.debit) > 0 ? Number(line.debit).toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}
                                            </div>
                                            <div className="col-span-3 text-right text-xs font-mono text-stone-900">
                                                {Number(line.credit) > 0 ? Number(line.credit).toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                })}

                {entries.length === 0 && (
                    <div className="text-center py-16 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
                        <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-stone-300 text-2xl">?</span>
                        </div>
                        <h3 className="text-stone-900 font-bold mb-1">No Ledger Entries</h3>
                        <p className="text-stone-500 text-sm">Get started by creating your first journal voucher.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

function getStatusStyle(status: string) {
    switch (status) {
        case 'POSTED': return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
        case 'DRAFT': return 'bg-stone-100 text-stone-600 border border-stone-200'
        case 'REVERSED': return 'bg-rose-100 text-rose-700 border border-rose-200'
        default: return 'bg-stone-100 text-stone-500'
    }
}