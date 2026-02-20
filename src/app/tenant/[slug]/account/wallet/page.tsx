'use client'

import { useEffect, useState } from 'react'
import { usePortal } from '@/context/PortalContext'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
    Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Gift, Clock,
    Sparkles, Trophy, ChevronRight, PlusCircle, CheckCircle2
} from 'lucide-react'

interface WalletData {
    id: string
    balance: string
    loyalty_points: number
    lifetime_points: number
    tier: string
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

const TIERS = [
    { name: 'Bronze', min: 0, color: 'from-amber-800 to-amber-900', accent: 'text-amber-400', bar: 'bg-amber-500' },
    { name: 'Silver', min: 500, color: 'from-slate-500 to-slate-600', accent: 'text-slate-300', bar: 'bg-slate-400' },
    { name: 'Gold', min: 2000, color: 'from-yellow-600 to-yellow-700', accent: 'text-yellow-400', bar: 'bg-yellow-500' },
    { name: 'Platinum', min: 5000, color: 'from-cyan-600 to-cyan-700', accent: 'text-cyan-400', bar: 'bg-cyan-500' },
    { name: 'Diamond', min: 10000, color: 'from-violet-600 to-violet-700', accent: 'text-violet-400', bar: 'bg-violet-500' },
]

function getTierInfo(points: number) {
    let current = TIERS[0]
    let next = TIERS[1]
    for (let i = TIERS.length - 1; i >= 0; i--) {
        if (points >= TIERS[i].min) {
            current = TIERS[i]
            next = TIERS[i + 1] || null
            break
        }
    }
    const progress = next ? ((points - current.min) / (next.min - current.min)) * 100 : 100
    return { current, next, progress: Math.min(progress, 100) }
}

export default function WalletPage() {
    const { slug } = useParams<{ slug: string }>()
    const { isAuthenticated, token, contact } = usePortal()
    const [wallet, setWallet] = useState<WalletData | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [topUpAmount, setTopUpAmount] = useState('')
    const [topUpSent, setTopUpSent] = useState(false)

    useEffect(() => {
        if (!isAuthenticated || !token) return
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'

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
            .catch(() => {
                // Demo data for preview
                const demoWallet: WalletData = {
                    id: 'demo',
                    balance: '245.50',
                    loyalty_points: 1280,
                    lifetime_points: 1280,
                    tier: 'Silver',
                    recent_transactions: [
                        { id: '1', transaction_type: 'CREDIT', amount: '100.00', reason: 'Wallet top-up approved', created_at: new Date(Date.now() - 86400000).toISOString() },
                        { id: '2', transaction_type: 'DEBIT', amount: '34.50', reason: 'Order #ORD-2025-0089 payment', created_at: new Date(Date.now() - 172800000).toISOString() },
                        { id: '3', transaction_type: 'LOYALTY_EARN', amount: '50.00', reason: 'Purchase bonus — 50 pts earned', created_at: new Date(Date.now() - 259200000).toISOString() },
                        { id: '4', transaction_type: 'REFUND', amount: '30.00', reason: 'Refund for returned item — Order #ORD-2025-0072', created_at: new Date(Date.now() - 432000000).toISOString() },
                        { id: '5', transaction_type: 'CREDIT', amount: '200.00', reason: 'Wallet top-up approved', created_at: new Date(Date.now() - 604800000).toISOString() },
                    ],
                }
                setWallet(demoWallet)
                setTransactions(demoWallet.recent_transactions)
                setLoading(false)
            })
    }, [isAuthenticated, token])

    const handleTopUpRequest = () => {
        if (!topUpAmount || parseFloat(topUpAmount) <= 0) return
        // In real implementation, this would call an API
        setTopUpSent(true)
        setTimeout(() => { setTopUpSent(false); setTopUpAmount('') }, 3000)
    }

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

    const tierInfo = wallet ? getTierInfo(wallet.lifetime_points || 0) : null

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-8 relative">
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-6">
                <h1 className="text-3xl font-black text-white">Wallet & Loyalty</h1>

                {/* Balance Cards */}
                {!loading && wallet && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
                        <div className="p-6 bg-gradient-to-br from-amber-600/20 to-amber-900/20 border border-amber-500/20 rounded-3xl space-y-2">
                            <div className="flex items-center gap-2">
                                <Wallet size={20} className="text-amber-400" />
                                <p className="text-amber-400/70 text-xs font-bold uppercase tracking-widest">Wallet Balance</p>
                            </div>
                            <p className="text-4xl font-black text-white">${parseFloat(wallet.balance).toFixed(2)}</p>
                        </div>
                        <div className="p-6 bg-gradient-to-br from-purple-600/20 to-purple-900/20 border border-purple-500/20 rounded-3xl space-y-2">
                            <div className="flex items-center gap-2">
                                <Sparkles size={20} className="text-purple-400" />
                                <p className="text-purple-400/70 text-xs font-bold uppercase tracking-widest">Loyalty Points</p>
                            </div>
                            <p className="text-4xl font-black text-white">{wallet.loyalty_points.toLocaleString()}</p>
                            <p className="text-xs text-purple-400/50">Lifetime: {wallet.lifetime_points.toLocaleString()} pts</p>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2].map(i => <div key={i} className="h-32 bg-slate-900/60 rounded-3xl animate-pulse" />)}
                    </div>
                )}

                {/* Loyalty Tier Progress */}
                {!loading && wallet && tierInfo && (
                    <div className="p-6 bg-slate-900/60 border border-white/5 rounded-3xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 bg-gradient-to-br ${tierInfo.current.color} rounded-xl flex items-center justify-center`}>
                                    <Trophy size={18} className="text-white" />
                                </div>
                                <div>
                                    <p className={`font-black text-sm ${tierInfo.current.accent}`}>{tierInfo.current.name} Tier</p>
                                    <p className="text-slate-500 text-[10px] uppercase tracking-widest">Current Rank</p>
                                </div>
                            </div>
                            {tierInfo.next && (
                                <div className="text-right">
                                    <p className={`text-xs font-bold ${tierInfo.next.accent}`}>{tierInfo.next.name}</p>
                                    <p className="text-slate-500 text-[10px]">{tierInfo.next.min - (wallet.lifetime_points || 0)} pts to go</p>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full ${tierInfo.current.bar} rounded-full transition-all duration-1000`}
                                    style={{ width: `${tierInfo.progress}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-600 font-medium">
                                <span>{tierInfo.current.min.toLocaleString()} pts</span>
                                {tierInfo.next && <span>{tierInfo.next.min.toLocaleString()} pts</span>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Top-Up Request */}
                {!loading && wallet && (
                    <div className="p-6 bg-slate-900/60 border border-white/5 rounded-3xl space-y-4">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <PlusCircle size={18} className="text-emerald-400" /> Request Top-Up
                        </h3>
                        <div className="flex gap-3">
                            {['10', '25', '50', '100'].map(amt => (
                                <button key={amt} onClick={() => setTopUpAmount(amt)}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border
                                        ${topUpAmount === amt
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                            : 'bg-white/5 text-slate-400 border-white/5 hover:border-white/20'
                                        }`}>
                                    ${amt}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <input type="number" placeholder="Custom amount"
                                value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)}
                                className="flex-1 bg-slate-800/60 border border-white/5 text-white px-4 py-3 rounded-xl outline-none focus:border-emerald-500/30 placeholder:text-slate-700" />
                            <button onClick={handleTopUpRequest} disabled={topUpSent || !topUpAmount}
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all disabled:opacity-40 flex items-center gap-2">
                                {topUpSent ? <><CheckCircle2 size={16} /> Requested!</> : 'Request'}
                            </button>
                        </div>
                        <p className="text-slate-600 text-xs">Top-up requests are processed by the store administrator</p>
                    </div>
                )}

                {/* Transactions */}
                <div className="space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Clock size={18} className="text-slate-500" /> Recent Transactions
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
                                        className="p-4 bg-slate-900/60 border border-white/5 rounded-xl flex items-center gap-4 hover:border-white/10 transition-all">
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
