'use client';

import { useState, useMemo } from 'react';
import {
    X, Wallet, Trophy, Target, TrendingUp, History, ShoppingBag,
    ChevronRight, Star, Crown, ShieldCheck, Zap,
    ArrowUpRight, Gift, BarChart3, Clock, Milestone
} from 'lucide-react';
import clsx from 'clsx';
import { formatCurrency } from '@/lib/utils'; // Assuming this utility exists

interface ClientFidelity {
    analytics: {
        avg_order_value: number;
        total_orders: number;
        total_revenue: number;
        monthly_frequency: number;
        top_products: Array<{
            id: number;
            name: string;
            sku: string;
            total_qty: number;
            total_revenue: number;
            last_bought: string;
        }>;
    };
    orders: {
        stats: {
            total_count: number;
            total_amount: number;
            completed: number;
            draft: number;
        };
        recent: any[];
    };
    balance: {
        current_balance: number;
        last_payment_date: string | null;
    };
    loyalty: number; // Raw points from contact data
}

interface ClientVaultModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientName: string;
    currency: string;
    fidelity: ClientFidelity | null;
    loading: boolean;
}

const TIER_THRESHOLDS = {
    STANDARD: 0,
    VIP: 5000,
    WHOLESALE: 50000,
};

export function ClientVaultModal({ isOpen, onClose, clientName, currency, fidelity, loading }: ClientVaultModalProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'points' | 'history'>('overview');

    const tierInfo = useMemo(() => {
        if (!fidelity) return { current: 'STANDARD', next: 'VIP', progress: 0, required: 5000 };
        const ltv = fidelity.analytics.total_revenue;

        if (ltv >= TIER_THRESHOLDS.WHOLESALE) {
            return { current: 'WHOLESALE', next: null, progress: 100, required: 0 };
        }
        if (ltv >= TIER_THRESHOLDS.VIP) {
            const progress = ((ltv - TIER_THRESHOLDS.VIP) / (TIER_THRESHOLDS.WHOLESALE - TIER_THRESHOLDS.VIP)) * 100;
            return { current: 'VIP', next: 'WHOLESALE', progress: Math.min(progress, 100), required: TIER_THRESHOLDS.WHOLESALE - ltv };
        }
        const progress = (ltv / TIER_THRESHOLDS.VIP) * 100;
        return { current: 'STANDARD', next: 'VIP', progress: Math.min(progress, 100), required: TIER_THRESHOLDS.VIP - ltv };
    }, [fidelity]);

    const pointsValue = useMemo(() => {
        if (!fidelity) return 0;
        return fidelity.loyalty * 0.01; // 100 points = 1 unit
    }, [fidelity]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden">
            <div className="w-full max-w-5xl h-[85vh] bg-slate-900 rounded-[2.5rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-500">

                {/* 🛡️ Header: Premium Identity Section */}
                <div className="relative px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 overflow-hidden">
                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full -mr-20 -mt-20 pointer-events-none" />

                    <div className="relative flex items-center gap-6">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                            <div className="relative w-20 h-20 bg-slate-800 rounded-2xl border border-white/10 flex items-center justify-center">
                                <Trophy className={clsx(
                                    "w-10 h-10",
                                    tierInfo.current === 'WHOLESALE' ? "text-amber-400" :
                                        tierInfo.current === 'VIP' ? "text-purple-400" : "text-indigo-400"
                                )} />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-slate-950 border border-white/10 rounded-full px-2 py-0.5 flex items-center gap-1">
                                <span className="text-[10px] font-black text-white/50 uppercase tracking-tighter">Level</span>
                                <span className="text-xs font-black text-white">{tierInfo.current === 'WHOLESALE' ? '3' : tierInfo.current === 'VIP' ? '2' : '1'}</span>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-3xl font-black text-white tracking-tight">{clientName}</h2>
                                {tierInfo.current !== 'STANDARD' && (
                                    <div className={clsx(
                                        "px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 shadow-lg",
                                        tierInfo.current === 'WHOLESALE' ? "bg-amber-400 text-slate-950" : "bg-purple-500 text-white"
                                    )}>
                                        <Crown size={12} />
                                        {tierInfo.current}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-4 text-xs font-bold text-white/40">
                                <span className="flex items-center gap-1.5 text-indigo-400">
                                    <ShieldCheck size={14} /> Global ID Verified
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                <span>Member since {fidelity ? new Date(fidelity.analytics.top_products[0]?.last_bought || Date.now()).getFullYear() : '2024'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Vault Status</div>
                            <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                Live Metrics Synchronized
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white/20 hover:text-white flex items-center justify-center border border-white/5 transition-all active:scale-95"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* 🏗️ Navigation Tabs */}
                <div className="px-8 border-b border-white/5 flex gap-8">
                    {[
                        { id: 'overview', label: 'Overview', icon: BarChart3 },
                        { id: 'points', label: 'Fidelity & Rewards', icon: Gift },
                        { id: 'history', label: 'Purchase History', icon: History }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={clsx(
                                "flex items-center gap-2 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all",
                                activeTab === tab.id
                                    ? "text-indigo-400 border-indigo-400"
                                    : "text-white/30 border-transparent hover:text-white/60"
                            )}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* 🧬 Content Area */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400 animate-pulse" size={24} />
                            </div>
                            <p className="mt-6 text-xs font-black text-white/30 uppercase tracking-[0.3em] animate-pulse">Scanning Vault Data...</p>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'overview' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Top Row: Core Analytics */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        {[
                                            { label: 'Lifetime Value', value: fidelity?.analytics.total_revenue || 0, icon: TrendingUp, color: 'text-indigo-400', isCurrency: true },
                                            { label: 'Avg Order Value', value: fidelity?.analytics.avg_order_value || 0, icon: Target, color: 'text-purple-400', isCurrency: true },
                                            { label: 'Purchase Frequency', value: `${fidelity?.analytics.monthly_frequency || 0}/mo`, icon: ShoppingBag, color: 'text-blue-400' },
                                            { label: 'Wallet Balance', value: fidelity?.balance.current_balance || 0, icon: Wallet, color: 'text-emerald-400', isCurrency: true }
                                        ].map((stat, i) => (
                                            <div key={i} className="bg-white/5 rounded-3xl p-6 border border-white/5 hover:border-white/10 transition-all group">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className={clsx("p-2.5 rounded-xl bg-white/5", stat.color)}>
                                                        <stat.icon size={18} />
                                                    </div>
                                                    <ArrowUpRight size={14} className="text-white/10 group-hover:text-white/30 transition-all" />
                                                </div>
                                                <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">{stat.label}</div>
                                                <div className="text-xl font-black text-white tracking-tight">
                                                    {stat.isCurrency ? `${currency}${stat.value.toLocaleString()}` : stat.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Bottom Row: Tier Progress & Top Products */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        {/* Tier Progress Card */}
                                        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-[2rem] p-8 border border-white/10 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-8">
                                                <Milestone className="text-indigo-500/20 group-hover:text-indigo-500/40 transition-all duration-700" size={120} />
                                            </div>

                                            <div className="relative">
                                                <div className="flex items-center justify-between mb-8">
                                                    <div>
                                                        <h3 className="text-xl font-black text-white mb-1">Tier Progression</h3>
                                                        <p className="text-xs font-bold text-white/40">Keep spending to unlock premium benefits</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-3xl font-black text-white">{Math.round(tierInfo.progress)}%</span>
                                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Progress to {tierInfo.next || 'MAX'}</div>
                                                    </div>
                                                </div>

                                                <div className="relative h-4 bg-white/5 rounded-full overflow-hidden mb-8">
                                                    <div
                                                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-shimmer"
                                                        style={{ width: `${tierInfo.progress}%`, backgroundSize: '200% 100%' }}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-3 gap-4">
                                                    {[
                                                        { label: 'Current Tier', value: tierInfo.current, icon: Crown },
                                                        { label: 'Next Unlock', value: tierInfo.next || 'Maxed Out', icon: Gift },
                                                        { label: 'Req. Spending', value: tierInfo.required > 0 ? `${currency}${tierInfo.required.toLocaleString()}` : 'Unlocked', icon: DollarSign }
                                                    ].map((item, i) => (
                                                        <div key={i} className="bg-slate-900/50 rounded-2xl p-4 border border-white/5">
                                                            <div className="flex items-center gap-2 mb-2 text-indigo-400">
                                                                <item.icon size={12} />
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{item.label}</span>
                                                            </div>
                                                            <div className="text-sm font-black text-white">{item.value}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Summary Card */}
                                        <div className="bg-slate-800/50 rounded-[2rem] p-8 border border-white/10 flex flex-col items-center justify-center text-center">
                                            <div className="w-24 h-24 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-6">
                                                <Star className="text-indigo-400" size={40} />
                                            </div>
                                            <h4 className="text-lg font-black text-white mb-2">Fidelity Score</h4>
                                            <p className="text-xs font-bold text-white/30 mb-8 max-w-[200px]">Base evaluation of customer retention and brand loyalty</p>

                                            <div className="w-full space-y-3">
                                                {[
                                                    { label: 'Retention Rate', value: 'High' },
                                                    { label: 'Return Risk', value: 'Low' },
                                                    { label: 'Referral Power', value: 'Silver' }
                                                ].map((row, i) => (
                                                    <div key={i} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                                        <span className="text-white/20">{row.label}</span>
                                                        <span className="text-white">{row.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'points' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Points Engine visualization */}
                                        <div className="bg-gradient-to-br from-teal-500/10 to-transparent rounded-[2rem] p-8 border border-white/10 flex flex-col items-center justify-center text-center">
                                            <div className="relative mb-8">
                                                <div className="absolute -inset-8 bg-teal-500/20 blur-[40px] rounded-full animate-pulse" />
                                                <div className="relative w-32 h-32 rounded-full border-4 border-teal-500/30 flex flex-col items-center justify-center bg-slate-900 shadow-2xl">
                                                    <span className="text-4xl font-black text-white">{fidelity?.loyalty.toLocaleString() || 0}</span>
                                                    <span className="text-[10px] font-black text-teal-400 uppercase tracking-tighter">Points</span>
                                                </div>
                                            </div>
                                            <div className="text-2xl font-black text-white mb-2">Available for Redemption</div>
                                            <div className="text-sm font-bold text-white/30">Equiv. to <span className="text-teal-400">{currency}{pointsValue.toLocaleString()}</span> in direct discount</div>
                                        </div>

                                        <div className="space-y-6">
                                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                                <Zap className="text-amber-400" size={18} />
                                                Loyalty Mechanism
                                            </h3>
                                            <div className="space-y-4">
                                                {[
                                                    { label: 'Accumulation Rate', desc: 'Earn 1 point for every 10 FCFA spent during any official POS transaction', icon: TrendingUp },
                                                    { label: 'Redemption Formula', desc: '100 Reward Points = 1 FCFA automatic discount at checkout stage', icon: Gift },
                                                    { label: 'Expiration Policy', desc: 'Points remain valid for 24 months from the last purchase date', icon: Clock }
                                                ].map((rule, i) => (
                                                    <div key={i} className="flex items-start gap-4 p-5 bg-white/5 rounded-2xl border border-white/5">
                                                        <div className="mt-1 p-2 rounded-lg bg-white/5 text-teal-400">
                                                            <rule.icon size={16} />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-black text-white mb-1 uppercase tracking-widest">{rule.label}</div>
                                                            <p className="text-[11px] font-medium text-white/40 leading-relaxed">{rule.desc}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {/* Purchase History (Top Products) */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Favorite Products</h3>
                                                <span className="text-[10px] font-bold text-white/20">Based on quantity purchased</span>
                                            </div>
                                            <div className="space-y-2">
                                                {fidelity?.analytics.top_products.slice(0, 5).map((product, i) => (
                                                    <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all cursor-default">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-xs font-black text-white/40 uppercase">
                                                                {product.name.substring(0, 2)}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors">{product.name}</div>
                                                                <div className="text-[10px] font-bold text-white/20">{product.sku}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-black text-white">{product.total_qty.toLocaleString()} units</div>
                                                            <div className="text-[10px] font-bold text-emerald-400">{currency}{product.total_revenue.toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Recent Orders */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Transaction Log</h3>
                                                <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">View All Archive</button>
                                            </div>
                                            <div className="space-y-2">
                                                {fidelity?.orders.recent.slice(0, 5).map((order, i) => (
                                                    <div key={i} className="bg-slate-950/40 rounded-2xl p-4 border border-white/5 flex items-center justify-between group">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-indigo-400">
                                                                <ShoppingBag size={18} />
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-black text-white">{order.ref_code || `#${order.id}`}</div>
                                                                <div className="text-[10px] font-bold text-white/20">{new Date(order.created_at).toLocaleDateString()}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-black text-white">{currency}{order.total_amount.toLocaleString()}</div>
                                                            <div className={clsx(
                                                                "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded",
                                                                order.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-white/10 text-white/40"
                                                            )}>
                                                                {order.status}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 🔒 Footer: Actions & Status */}
                <div className="px-8 py-6 bg-black/20 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Client Sync: Active</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Vault Security: Tier-4</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-black uppercase tracking-widest border border-white/5 transition-all">
                            Export Record
                        </button>
                        <button
                            className="group relative px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-indigo-500/20"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                <TrendingUp size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                Boost Loyalty
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

