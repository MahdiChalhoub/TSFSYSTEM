'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../engine/hooks/useAuth'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'
import {
    Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Gift, Clock,
    Sparkles, Trophy, ChevronRight, PlusCircle, CheckCircle2, Shield, ArrowLeft
} from 'lucide-react'

interface WalletData {
    id: string; balance: string; loyalty_points: number; lifetime_points: number; tier: string
    recent_transactions: Transaction[]
}
interface Transaction {
    id: string; type: string; amount: string; description: string; created_at: string
}

export default function MidnightWalletPage() {
    const { path, slug } = useStorefrontPath()
    const { isAuthenticated } = useAuth()
    const [wallet, setWallet] = useState<WalletData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isAuthenticated) { setLoading(false); return }
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        const token = localStorage.getItem('portal_token')
        fetch(`${djangoUrl}/api/client-portal/my-wallet/`, { headers: { 'Authorization': `Token ${token}` } })
            .then(r => r.json())
            .then(data => { setWallet(data); setLoading(false) })
            .catch(() => {
                setWallet({
                    id: 'w1', balance: '245.50', loyalty_points: 1280, lifetime_points: 4500, tier: 'Platinum',
                    recent_transactions: [
                        { id: 't1', type: 'CREDIT', amount: '100.00', description: 'Wallet top-up', created_at: new Date(Date.now() - 86400000).toISOString() },
                        { id: 't2', type: 'DEBIT', amount: '54.50', description: 'Order #ORD-2025-0089', created_at: new Date(Date.now() - 172800000).toISOString() },
                        { id: 't3', type: 'REWARD', amount: '200', description: 'Loyalty reward - 200 pts', created_at: new Date(Date.now() - 259200000).toISOString() },
                    ]
                })
                setLoading(false)
            })
    }, [isAuthenticated])

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <div className="text-center space-y-8">
                    <div className="w-24 h-24 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center justify-center mx-auto text-amber-400 rotate-12">
                        <Shield size={48} />
                    </div>
                    <h1 className="text-3xl font-black text-white italic">Session Required</h1>
                    <Link href={path('/login')} className="inline-flex items-center gap-3 px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest">
                        Authorize <ChevronRight size={16} />
                    </Link>
                </div>
            </div>
        )
    }

    const tierColors: Record<string, string> = {
        Bronze: 'from-orange-700 to-orange-900', Silver: 'from-slate-400 to-slate-600',
        Gold: 'from-amber-400 to-amber-600', Platinum: 'from-purple-400 to-indigo-500',
    }
    const tierProgress = wallet ? Math.min((wallet.loyalty_points / 2000) * 100, 100) : 0

    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:p-12 relative overflow-hidden">
            <div className="fixed bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-500/5 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-5xl mx-auto relative z-10 space-y-10">
                <div className="space-y-4">
                    <Link href={path('/account')}
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
                    </Link>
                    <h1 className="text-5xl font-black text-white italic tracking-tighter">Liquid <span className="text-amber-400">Assets</span></h1>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : wallet && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-10 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[3rem] relative overflow-hidden shadow-2xl shadow-emerald-900/30">
                                <div className="absolute top-0 right-0 p-6 text-white/10"><Wallet size={120} /></div>
                                <div className="relative z-10 space-y-6">
                                    <div className="flex items-center gap-3 text-emerald-200/70">
                                        <Wallet size={20} />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Wallet Balance</span>
                                    </div>
                                    <p className="text-5xl font-black text-white italic tracking-tighter">${parseFloat(wallet.balance).toFixed(2)}</p>
                                    <button className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-md rounded-2xl text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/30 transition-all">
                                        <PlusCircle size={16} /> Request Top-Up
                                    </button>
                                </div>
                            </div>
                            <div className={`p-10 bg-gradient-to-br ${tierColors[wallet.tier] || tierColors.Gold} rounded-[3rem] relative overflow-hidden shadow-2xl`}>
                                <div className="absolute top-0 right-0 p-6 text-white/10"><Trophy size={120} /></div>
                                <div className="relative z-10 space-y-6">
                                    <div className="flex items-center gap-3 text-white/70">
                                        <Sparkles size={20} />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">{wallet.tier} Tier</span>
                                    </div>
                                    <p className="text-5xl font-black text-white italic tracking-tighter">{wallet.loyalty_points.toLocaleString()}</p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-white/60">
                                            <span>Progress</span>
                                            <span>{wallet.loyalty_points} / 2,000</span>
                                        </div>
                                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                            <div className="h-full bg-white rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ width: `${tierProgress}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-10 bg-slate-900/40 border border-white/5 rounded-[3rem] space-y-8">
                            <h2 className="text-xl font-black text-white italic">Transaction Ledger</h2>
                            {wallet.recent_transactions.length === 0 ? (
                                <p className="text-slate-500 text-sm text-center py-8">No transactions recorded</p>
                            ) : (
                                <div className="space-y-4">
                                    {wallet.recent_transactions.map(tx => {
                                        const isCredit = tx.type === 'CREDIT' || tx.type === 'REWARD'
                                        return (
                                            <div key={tx.id} className="flex items-center gap-6 p-5 bg-slate-950/50 border border-white/5 rounded-[2rem] hover:border-white/10 transition-all">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isCredit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                    {tx.type === 'REWARD' ? <Gift size={20} /> : isCredit ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white font-bold text-sm">{tx.description}</p>
                                                    <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest mt-1 flex items-center gap-2">
                                                        <Clock size={10} /> {new Date(tx.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <p className={`text-lg font-black italic ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {isCredit ? '+' : '-'}{tx.type === 'REWARD' ? `${tx.amount} pts` : `$${parseFloat(tx.amount).toFixed(2)}`}
                                                </p>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
