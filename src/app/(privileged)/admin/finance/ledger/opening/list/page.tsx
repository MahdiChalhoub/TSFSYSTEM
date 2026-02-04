import { getOpeningEntries } from '@/app/actions/finance/ledger'
import Link from 'next/link'
import { Plus, Table, Calendar, ArrowUpRight, ArrowLeft } from 'lucide-react'

export default async function OpeningBalancesListPage() {
    const entries = await getOpeningEntries()

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <Link href="/admin/finance/ledger" className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors text-xs font-bold uppercase tracking-wider mb-2">
                        <ArrowLeft size={14} /> Back to Ledger
                    </Link>
                    <h1 className="text-3xl font-bold text-stone-900 font-serif">Opening Balances</h1>
                    <p className="text-sm text-stone-500">View and manage initial account balances</p>
                </div>
                <Link
                    href="/admin/finance/ledger/opening"
                    className="bg-black text-white px-6 py-2.5 rounded-lg hover:bg-stone-800 font-bold text-sm shadow-md transition-all flex items-center gap-2"
                >
                    <Plus size={18} /> Add Opening Balance
                </Link>
            </div>

            <div className="space-y-4">
                {entries.map((entry: any) => {
                    const totalValue = entry.lines.reduce((sum: number, l: any) => sum + Number(l.debit), 0)

                    return (
                        <div key={entry.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                            <div className="p-5 flex justify-between items-center bg-stone-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white border border-stone-200 rounded-lg flex items-center justify-center text-stone-400 group-hover:text-black transition-colors">
                                        <Table size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-stone-900">Opening Balance #{entry.id}</h3>
                                            <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Locked</span>
                                        </div>
                                        <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                                            <Calendar size={12} /> {entry.transactionDate.toLocaleDateString('en-GB')}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold uppercase text-stone-400 tracking-widest mb-1">Total Value</div>
                                    <div className="font-mono font-bold text-stone-900 text-lg">
                                        {totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>

                            <div className="px-5 py-3 border-t border-stone-100 flex justify-between items-center text-sm">
                                <span className="text-stone-500 italic truncate max-w-md">{entry.description || 'Opening state of accounts'}</span>
                                <Link
                                    href={`/admin/finance/ledger/${entry.id}`}
                                    className="text-stone-900 font-bold hover:underline flex items-center gap-1"
                                >
                                    View Voucher <ArrowUpRight size={14} />
                                </Link>
                            </div>
                        </div>
                    )
                })}

                {entries.length === 0 && (
                    <div className="text-center py-20 bg-stone-50 border-2 border-dashed border-stone-200 rounded-2xl">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <Table size={32} className="text-stone-300" />
                        </div>
                        <h3 className="text-stone-900 font-bold text-lg mb-2">No Opening Balances Found</h3>
                        <p className="text-stone-500 max-w-xs mx-auto mb-6">You haven't recorded any opening balances yet. These are typically done at the start of a fiscal year.</p>
                        <Link
                            href="/admin/finance/ledger/opening"
                            className="inline-flex items-center gap-2 text-black font-bold hover:underline"
                        >
                            Record Initial Balance <ArrowUpRight size={18} />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
