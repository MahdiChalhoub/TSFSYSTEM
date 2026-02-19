'use client'

import { useEffect, useState } from 'react'
import { usePortal } from '@/context/PortalContext'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Gift, CreditCard, Clock } from 'lucide-react'

interface WalletData {
    id: string
    balance: string
    loyalty_points: number
    lifetime_points: number
    recent_transactions: Transaction[]
}

interface Transaction {
    id: string
    transaction_type: string
    amount: string
    reason: string
    created_at: string
}

const TXN_ICONS: Record<string, { icon: any; color: string }> = {
    CREDIT: { icon: ArrowDownRight, color: 'text-emerald-400' },
    DEBIT: { icon: ArrowUpRight, color: 'text-red-400' },
    LOYALTY_EARN: { icon: TrendingUp, color: 'text-purple-400' },
    LOYALTY_REDEEM: { icon: Gift, color: 'text-amber-400' },
    REFUND: { icon: ArrowDownRight, color: 'text-blue-400' },
}

export default function WalletPage() {
    const { slug } = useParams<{ slug: string }>()
    const { isAuthenticated, token, contact } = usePortal()
    const [wallet, setWallet] = useState<WalletData | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isAuthenticated || !token) return
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'

        // Fetch wallet
        fetch(`${djangoUrl}/api/client-portal/my-wallet/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
            .then(r => r.json())
            .then(data => {
                const walletData = Array.isArray(data) ? data[0] : data
                setWallet(walletData)
                setTransactions(walletData?.recent_transactions || [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [isAuthenticated, token])

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-white">Please log in</h1>
                    <Link href={`/tenant/${slug}`} className="text-emerald-400 font-bold">Go to Store</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-8">
                <div className="space-y-2">
                    <Link href={`/tenant/${slug}/account`}
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> My Account
                    </Link>
                    <h1 className="text-4xl font-black text-white">Wallet & Loyalty</h1>
                </div>

                {/* Balance Cards */}
                {!loading && wallet && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
                        <div className="p-8 bg-gradient-to-br from-amber-600/20 to-amber-900/20 border border-amber-500/20 rounded-3xl space-y-3">
                            <div className="flex items-center gap-3">
                                <Wallet size={24} className="text-amber-400" />
                                <p className="text-amber-400/70 text-sm font-bold uppercase tracking-widest">Wallet Balance</p>
                            </div>
                            <p className="text-5xl font-black text-white">${parseFloat(wallet.balance).toFixed(2)}</p>
                        </div>
                        <div className="p-8 bg-gradient-to-br from-purple-600/20 to-purple-900/20 border border-purple-500/20 rounded-3xl space-y-3">
                            <div className="flex items-center gap-3">
                                <TrendingUp size={24} className="text-purple-400" />
                                <p className="text-purple-400/70 text-sm font-bold uppercase tracking-widest">Loyalty Points</p>
                            </div>
                            <p className="text-5xl font-black text-white">{wallet.loyalty_points}</p>
                            <p className="text-sm text-purple-400/60">Lifetime: {wallet.lifetime_points} pts</p>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2].map(i => <div key={i} className="h-40 bg-slate-900/60 rounded-3xl animate-pulse" />)}
                    </div>
                )}

                {/* Transactions */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <Clock size={20} className="text-slate-500" /> Recent Transactions
                    </h2>
                    {transactions.length === 0 ? (
                        <div className="py-12 text-center text-slate-500">No transactions yet</div>
                    ) : (
                        <div className="space-y-2">
                            {transactions.map(txn => {
                                const config = TXN_ICONS[txn.transaction_type] || TXN_ICONS.CREDIT
                                const Icon = config.icon
                                const isCredit = ['CREDIT', 'REFUND', 'LOYALTY_EARN'].includes(txn.transaction_type)
                                return (
                                    <div key={txn.id}
                                        className="p-5 bg-slate-900/60 border border-white/5 rounded-xl flex items-center gap-4 hover:border-white/10 transition-all">
                                        <div className={`w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center ${config.color}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium text-sm truncate">{txn.reason || txn.transaction_type}</p>
                                            <p className="text-slate-500 text-[11px]">{new Date(txn.created_at).toLocaleString()}</p>
                                        </div>
                                        <p className={`font-bold text-lg ${isCredit ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isCredit ? '+' : '-'}${Math.abs(parseFloat(txn.amount)).toFixed(2)}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
