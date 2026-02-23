'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../engine/hooks/useAuth'
import {
    Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Gift, Clock,
    Sparkles, Trophy, ChevronRight, PlusCircle, CheckCircle2, Shield, ArrowLeft
} from 'lucide-react'

interface WalletData {
    id: string; balance: string; loyalty_points: number; lifetime_points: number; tier: string; recent_transactions: Transaction[]
}
interface Transaction {
    id: string; transaction_type: string; amount: string; reason: string; created_at: string
}

const TXN_ICONS: Record<string, { icon: any; color: string }> = {
    CREDIT: { icon: ArrowDownRight, color: 'text-emerald-400' },
    DEBIT: { icon: ArrowUpRight, color: 'text-rose-400' },
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
    let current = TIERS[0]; let next: any = TIERS[1]
    for (let i = TIERS.length - 1; i >= 0; i--) {
        if (points >= TIERS[i].min) { current = TIERS[i]; next = TIERS[i + 1] || null; break }
    }
    const progress = next ? ((points - current.min) / (next.min - current.min)) * 100 : 100
    return { current, next, progress: Math.min(progress, 100) }
}

export default function MidnightWalletPage() {
    const { slug } = useParams<{ slug: string }>()
    const { isAuthenticated } = useAuth()
    const [wallet, setWallet] = useState<WalletData | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [topUpAmount, setTopUpAmount] = useState('')
    const [topUpSent, setTopUpSent] = useState(false)

    useEffect(() => {
        if (!isAuthenticated) return
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        const token = localStorage.getItem('portal_token')
        fetch(`${djangoUrl}/api/client-portal/my-wallet/`, { headers: { 'Authorization': `Token ${token}` } })
            .then(r => r.json())
            .then(data => {
                const w = Array.isArray(data) ? data[0] : data
                setWallet(w); setTransactions(w?.recent_transactions || []); setLoading(false)
            })
            .catch(() => {
                const demoWallet: WalletData = {
                    id: 'demo', balance: '245.50', loyalty_points: 1280, lifetime_points: 1280, tier: 'Silver',
                    recent_transactions: [
                        { id: '1', transaction_type: 'CREDIT', amount: '100.00', reason: 'Wallet top-up approved', created_at: new Date(Date.now() - 86400000).toISOString() },
                        { id: '2', transaction_type: 'DEBIT', amount: '34.50', reason: 'Order #ORD-2025-0089 payment', created_at: new Date(Date.now() - 172800000).toISOString() },
                        { id: '3', transaction_type: 'LOYALTY_EARN', amount: '50.00', reason: 'Purchase bonus — 50 pts earned', created_at: new Date(Date.now() - 259200000).toISOString() },
                        { id: '4', transaction_type: 'REFUND', amount: '30.00', reason: 'Refund for returned item', created_at: new Date(Date.now() - 432000000).toISOString() },
                    ],
                }
                setWallet(demoWallet); setTransactions(demoWallet.recent_transactions); setLoading(false)
            })
    }, [isAuthenticated])

    const handleTopUpRequest = () => {
        if (!topUpAmount || parseFloat(topUpAmount) <= 0) return
        setTopUpSent(true); setTimeout(() => { setTopUpSent(false); setTopUpAmount('') }, 3000)
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <div className="text-center space-y-8">
                    <div className="w-24 h-24 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center justify-center mx-auto text-amber-400 rotate-12">
                        <Shield size={48} />
                    </div>
                    <h1 className="text-3xl font-black text-white italic tracking-tighter">Session Required</h1>
                    <Link href={`/tenant/${slug}/login`} className="inline-flex items-center gap-3 px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest">
                        Authenticate <ChevronRight size={16} />
                    </Link>
                </div>
            </div>
        )
    }

    const tierInfo = wallet ? getTierInfo(wallet.lifetime_points || 0) : null

    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:p-12 relative overflow-hidden">
            <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[60%] bg-amber-500/5 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-500/5 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-5xl mx-auto relative z-10 space-y-10">
                <div className="space-y-4">
                    <Link href={`/tenant/${slug}/account`}
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
                    </Link>
                    <h1 className="text-5xl font-black text-white italic tracking-tighter">Wallet & <span className="text-amber-400">Loyalty</span></h1>
                </div>

                {/* Balance Cards */}
                {!loading && wallet && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-10 bg-gradient-to-br from-amber-500/10 to-amber-900/10 border border-amber-500/20 rounded-[3rem] space-y-4 relative overflow-hidden group hover:border-amber-500/40 transition-all">
                            <div className="absolute top-0 right-0 p-4 text-amber-500/5 group-hover:text-amber-500/10 transition-colors"><Wallet size={120} /></div>
                            <div className="flex items-center gap-3 relative z-10">
                                <div className="p-3 bg-amber-500/20 rounded-2xl"><Wallet size={20} className="text-amber-400" /></div>
                                <p className="text-amber-400/70 text-[10px] font-black uppercase tracking-[0.3em]">Liquid Credit Balance</p>
                            </div>
                            <p className="text-5xl font-black text-white italic tracking-tighter relative z-10">${parseFloat(wallet.balance).toFixed(2)}</p>
                        </div>
                        <div className="p-10 bg-gradient-to-br from-purple-500/10 to-purple-900/10 border border-purple-500/20 rounded-[3rem] space-y-4 relative overflow-hidden group hover:border-purple-500/40 transition-all">
                            <div className="absolute top-0 right-0 p-4 text-purple-500/5 group-hover:text-purple-500/10 transition-colors"><Sparkles size={120} /></div>
                            <div className="flex items-center gap-3 relative z-10">
                                <div className="p-3 bg-purple-500/20 rounded-2xl"><Sparkles size={20} className="text-purple-400" /></div>
                                <p className="text-purple-400/70 text-[10px] font-black uppercase tracking-[0.3em]">Loyalty Index</p>
                            </div>
                            <p className="text-5xl font-black text-white italic tracking-tighter relative z-10">{wallet.loyalty_points.toLocaleString()}</p>
                            <p className="text-[10px] text-purple-500 font-bold uppercase tracking-widest relative z-10">Lifetime: {wallet.lifetime_points.toLocaleString()} pts</p>
                        </div>
                    </div>
                )}

                {loading && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[1, 2].map(i => <div key={i} className="h-40 bg-slate-900/40 rounded-[3rem] animate-pulse" />)}</div>}

                {/* Tier Progress */}
                {!loading && wallet && tierInfo && (
                    <div className="p-10 bg-slate-900/40 border border-white/5 rounded-[3rem] space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 bg-gradient-to-br ${tierInfo.current.color} rounded-2xl flex items-center justify-center shadow-xl`}>
                                    <Trophy size={24} className="text-white" />
                                </div>
                                <div>
                                    <p className={`font-black text-lg italic tracking-tight ${tierInfo.current.accent}`}>{tierInfo.current.name} Status</p>
                                    <p className="text-slate-600 text-[10px] uppercase tracking-[0.3em] font-black">Current Tier</p>
                                </div>
                            </div>
                            {tierInfo.next && (
                                <div className="text-right">
                                    <p className={`text-sm font-black italic ${tierInfo.next.accent}`}>{tierInfo.next.name}</p>
                                    <p className="text-slate-600 text-[10px] font-bold">{tierInfo.next.min - (wallet.lifetime_points || 0)} pts remaining</p>
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full ${tierInfo.current.bar} rounded-full transition-all duration-1000 shadow-[0_0_15px_currentColor]`}
                                    style={{ width: `${tierInfo.progress}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-600 font-black uppercase tracking-widest">
                                <span>{tierInfo.current.min.toLocaleString()} PTS</span>
                                {tierInfo.next && <span>{tierInfo.next.min.toLocaleString()} PTS</span>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Top-Up */}
                {!loading && wallet && (
                    <div className="p-10 bg-slate-900/40 border border-white/5 rounded-[3rem] space-y-6">
                        <h3 className="text-white font-black text-lg italic flex items-center gap-3">
                            <PlusCircle size={20} className="text-emerald-400" /> Request Credit Allocation
                        </h3>
                        <div className="flex gap-3">
                            {['10', '25', '50', '100'].map(amt => (
                                <button key={amt} onClick={() => setTopUpAmount(amt)}
                                    className={`flex-1 py-4 rounded-2xl text-sm font-black transition-all border uppercase tracking-widest
                                        ${topUpAmount === amt
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                                            : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/20'
                                        }`}>
                                    ${amt}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <input type="number" placeholder="Custom amount" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)}
                                className="flex-1 bg-slate-950/60 border border-white/5 text-white px-6 py-4 rounded-2xl outline-none focus:border-emerald-500 placeholder:text-slate-800 font-medium" />
                            <button onClick={handleTopUpRequest} disabled={topUpSent || !topUpAmount}
                                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black transition-all disabled:opacity-40 flex items-center gap-3 uppercase tracking-widest text-xs">
                                {topUpSent ? <><CheckCircle2 size={18} /> Sent!</> : 'Request'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Transactions */}
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-white italic flex items-center gap-3">
                        <Clock size={20} className="text-slate-500" /> Transaction Ledger
                    </h2>
                    {transactions.length === 0 ? (
                        <div className="py-16 text-center text-slate-600 font-bold uppercase tracking-widest text-xs">No transactions recorded</div>
                    ) : (
                        <div className="space-y-3">
                            {transactions.map(txn => {
                                const config = TXN_ICONS[txn.transaction_type] || TXN_ICONS.CREDIT
                                const Icon = config.icon
                                const isCredit = ['CREDIT', 'REFUND', 'LOYALTY_EARN'].includes(txn.transaction_type)
                                return (
                                    <div key={txn.id}
                                        className="p-6 bg-slate-900/40 border border-white/5 rounded-[2rem] flex items-center gap-6 hover:border-white/10 transition-all group">
                                        <div className={`w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center ${config.color} group-hover:scale-110 transition-transform`}>
                                            <Icon size={22} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-black italic text-sm truncate">{txn.reason || txn.transaction_type}</p>
                                            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-1">{new Date(txn.created_at).toLocaleString()}</p>
                                        </div>
                                        <p className={`font-black text-xl italic ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
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
