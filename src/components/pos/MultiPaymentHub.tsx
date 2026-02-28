'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    ArrowLeft, Check, Plus, Banknote, CreditCard,
    Wallet, Smartphone, Landmark, MapPin, Star, Calculator,
    Trash2, RefreshCw, ShieldCheck, UserPlus, Coins, AlertCircle,
    Gift, Keyboard, Percent
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

interface PaymentLeg {
    method: string;
    amount: number;
}

interface MultiPaymentDashboardProps {
    totalAmount: number;
    currency: string;
    paymentMethods: any[];
    client: any;
    onConfirm: (legs: PaymentLeg[]) => void;
    onCancel: () => void;
    isProcessing: boolean;
    allowedAccounts?: any[];
}

const formatNumber = (num: number | string) => {
    const val = Number(num) || 0;
    const parts = val.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts[1] === '00' ? parts[0] : parts.join('.');
};

const getMethodIcon = (k: string) => {
    const key = k.toUpperCase();
    if (key.includes('CARD')) return CreditCard;
    if (key.includes('WALLET')) return Wallet;
    if (key.includes('WAVE') || key.includes('OM') || key.includes('PHONE')) return Smartphone;
    if (key.includes('DELIVERY')) return MapPin;
    if (key.includes('BANK')) return Landmark;
    if (key.includes('REWARD') || key.includes('LOYALTY') || key.includes('POINT')) return Star;
    return Banknote;
};

export function MultiPaymentDashboard({
    totalAmount,
    currency,
    paymentMethods,
    client,
    onConfirm,
    onCancel,
    isProcessing,
    allowedAccounts = []
}: MultiPaymentDashboardProps) {
    const [paymentLegs, setPaymentLegs] = useState<PaymentLeg[]>([]);
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
    const [amountBuffer, setAmountBuffer] = useState('');
    const [appliedSpecials, setAppliedSpecials] = useState<Set<string>>(new Set()); // Prevents double-click on one-shot methods
    const [isAccountSelectOpen, setIsAccountSelectOpen] = useState(false);
    const availableCredit = useMemo(() => {
        if (!client || client.id === 1) return 0; // Walk-ins have no credit
        // currentBalance is negative if they owe money, positive if they have credit
        return (client.creditLimit || 0) + (client.currentBalance || 0);
    }, [client]);

    const paidTotal = useMemo(() => paymentLegs.reduce((sum, leg) => sum + leg.amount, 0), [paymentLegs]);
    const remaining = totalAmount - paidTotal;

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Set first non-multi method as default on mount
        const firstMethod = paymentMethods.find(m => !m.key.includes('MULTI'));
        if (firstMethod) setSelectedMethod(firstMethod.key);
    }, [paymentMethods]);

    const handleAddLeg = useCallback((methodOverride?: string, amountOverride?: number) => {
        const method = methodOverride || selectedMethod;
        if (!method) {
            toast.error('Please select a payment method');
            return;
        }
        const amount = amountOverride !== undefined ? amountOverride : parseFloat(amountBuffer);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        // Mark one-shot special methods as applied
        const SPECIAL_METHODS = ['REWARD_POINTS', 'WALLET_DEBIT', 'ACCOUNT_DEBIT', 'ROUND_OFF', 'WALLET_CREDIT'];
        if (SPECIAL_METHODS.includes(method)) {
            if (appliedSpecials.has(method)) {
                toast.error(`${method.replace('_', ' ')} already applied`);
                return;
            }
            setAppliedSpecials(prev => new Set([...prev, method]));
        }

        setPaymentLegs(prev => [...prev, { method, amount }]);
        setAmountBuffer('');
        toast.success(`${method} entry added`);
    }, [selectedMethod, amountBuffer, appliedSpecials]);

    const handleSurplusToWallet = () => {
        if (remaining >= 0) return;
        const surplus = Math.abs(remaining);
        handleAddLeg('WALLET_CREDIT', surplus);
    };

    const handleDeficitToAccount = () => {
        if (remaining <= 0) return;

        // Security Check: Credit Limit
        if (remaining > availableCredit && client?.id !== 1) {
            toast.error(`Credit Limit Exceeded! Available: ${currency}${formatNumber(availableCredit)}`);
            return;
        }

        handleAddLeg('ACCOUNT_DEBIT', remaining);
    };

    // Round Off (Discount for coin rounding — posts to ROUND_OFF account)
    const ROUND_OFF_MAX = 500; // Maximum amount that can be rounded off
    const handleRoundOff = (roundTo?: number) => {
        if (remaining <= 0) { toast.error('No remaining balance to round off'); return; }
        let roundOffAmount = remaining;
        if (roundTo && roundTo > 0) {
            // Round down: e.g. if remaining=1788 and roundTo=100, discount = 1788 - 1700 = 88
            const roundedDown = Math.floor(remaining / roundTo) * roundTo;
            roundOffAmount = remaining - roundedDown;
            if (roundOffAmount <= 0) { toast.error('Amount already rounded'); return; }
        }
        if (roundOffAmount > ROUND_OFF_MAX) {
            toast.error(`Round-off limited to ${currency}${formatNumber(ROUND_OFF_MAX)}`);
            return;
        }
        handleAddLeg('ROUND_OFF', roundOffAmount);
        toast.success(`Applied ${currency}${formatNumber(roundOffAmount)} round-off discount`);
    };

    // Use Reward Points
    const handleUseRewardPoints = () => {
        if (!client || client.id === 1) { toast.error('Walk-in customers have no reward points'); return; }
        const pts = client.loyalty || 0;
        if (pts <= 0) { toast.error('No reward points available'); return; }
        if (remaining <= 0) { toast.error('No remaining balance to apply points to'); return; }
        const usable = Math.min(pts, remaining);
        handleAddLeg('REWARD_POINTS', usable);
        toast.success(`Applied ${currency}${formatNumber(usable)} from Reward Points`);
    };

    // Use Wallet Balance
    const handleUseWallet = () => {
        if (!client || client.id === 1) { toast.error('Walk-in customers have no wallet'); return; }
        const walletBal = client.balance || 0;
        if (walletBal <= 0) { toast.error('No wallet balance available'); return; }
        if (remaining <= 0) { toast.error('No remaining balance to apply wallet to'); return; }
        const usable = Math.min(walletBal, remaining);
        handleAddLeg('WALLET_DEBIT', usable);
        toast.success(`Applied ${currency}${formatNumber(usable)} from Wallet`);
    };

    const handleNumpadAction = useCallback((d: string) => {
        if (d === 'C') {
            setAmountBuffer('');
        } else if (d === 'X') {
            setAmountBuffer(prev => prev.slice(0, -1));
        } else if (d === '.') {
            setAmountBuffer(prev => prev.includes('.') ? prev : prev + d);
        } else {
            setAmountBuffer(prev => prev + d);
        }
    }, []);

    // ── KEYBOARD SUPPORT ──
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input/textarea element
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                handleNumpadAction(e.key);
            } else if (e.key === '.' || e.key === ',') {
                e.preventDefault();
                handleNumpadAction('.');
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                handleNumpadAction('X');
            } else if (e.key === 'Delete' || e.key === 'Escape') {
                e.preventDefault();
                handleNumpadAction('C');
            } else if (e.key === 'Enter' || e.key === '+') {
                e.preventDefault();
                if (amountBuffer) {
                    handleAddLeg();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [amountBuffer, handleAddLeg]);

    return (
        <div ref={containerRef} className="flex flex-col h-full bg-[#0F172A] overflow-hidden animate-in fade-in duration-500" tabIndex={0}>
            {/* ── COMPACT HEADER ── */}
            <div className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-white/5 bg-[#0F172A] z-20 shadow-xl">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onCancel}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all active:scale-95 group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] block mb-0.5">Payment Dashboard</span>
                        <h1 className="text-lg font-black text-white uppercase tracking-tighter">Multi-Method Hub</h1>
                    </div>
                </div>

                <div className="text-right">
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] block mb-0.5">Sale Total</span>
                    <div className="text-xl font-black text-white tabular-nums tracking-tighter">
                        {currency}{formatNumber(totalAmount)}
                    </div>
                </div>
            </div>

            {/* ── TWO COLUMN MAIN LAYOUT ── */}
            <div className="flex-1 flex min-h-0 relative">

                {/* ════ LEFT COLUMN: INTERACTION (45%) ════ */}
                <div className="w-[45%] flex flex-col bg-slate-900/40 border-r border-white/5 p-6 space-y-6 overflow-y-auto custom-scrollbar">

                    {/* 1. Value Entry Display */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] block">Manual Entry</span>
                            <div className="flex items-center gap-1.5 text-emerald-400/40">
                                <Keyboard size={12} />
                                <span className="text-[8px] font-black uppercase tracking-widest">Keyboard Active</span>
                            </div>
                        </div>
                        <div className="bg-black/40 rounded-3xl p-6 border-2 border-white/5 ring-4 ring-black/10 relative group">
                            <div className="flex items-baseline justify-between mb-1">
                                <span className="text-[9px] font-black text-emerald-400/60 uppercase tracking-widest">Amount to Add</span>
                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{currency}</span>
                            </div>
                            <div className="text-5xl font-black text-white tabular-nums tracking-tighter flex items-center gap-2">
                                {amountBuffer || '0.00'}
                                <div className="w-1 h-10 bg-emerald-500/50 animate-pulse rounded-full" />
                            </div>

                            {remaining > 0 && !amountBuffer && (
                                <button
                                    onClick={() => setAmountBuffer(remaining.toFixed(2))}
                                    className="absolute top-4 right-4 h-8 px-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-indigo-500/20 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    Quick Fill
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 2. Method Grid */}
                    <div className="space-y-3">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] block">Select Source</span>
                        <div className="grid grid-cols-2 gap-2">
                            {paymentMethods.filter(m => !m.key.includes('MULTI')).slice(0, 8).map(m => {
                                const Icon = getMethodIcon(m.key);
                                const isSelected = selectedMethod === m.key;
                                return (
                                    <button
                                        key={m.key}
                                        onClick={() => setSelectedMethod(m.key)}
                                        className={clsx(
                                            "h-14 rounded-2xl border flex items-center px-4 gap-3 transition-all group relative overflow-hidden",
                                            isSelected
                                                ? "bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/20"
                                                : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10"
                                        )}
                                    >
                                        <Icon size={20} className={clsx(isSelected ? "text-white" : "text-white/10 group-hover:text-white/30")} />
                                        <span className="text-[10px] font-black uppercase tracking-widest truncate">{m.label}</span>
                                        {isSelected && <div className="absolute top-0 right-0 w-8 h-8 bg-white/10 rounded-bl-2xl flex items-center justify-center"><Check size={12} strokeWidth={4} /></div>}
                                    </button>
                                );
                            })}

                            {/* Other Account Button */}
                            {allowedAccounts.length > 0 && (
                                <div className="relative col-span-2">
                                    <button
                                        onClick={() => setIsAccountSelectOpen(!isAccountSelectOpen)}
                                        className={clsx(
                                            "w-full h-14 rounded-2xl border flex items-center px-4 gap-3 transition-all group relative overflow-hidden",
                                            selectedMethod?.startsWith('ACCT:')
                                                ? "bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/20"
                                                : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10"
                                        )}
                                    >
                                        <Landmark size={20} className={clsx(selectedMethod?.startsWith('ACCT:') ? "text-white" : "text-white/10 group-hover:text-white/30")} />
                                        <span className="text-[10px] font-black uppercase tracking-widest truncate">
                                            {selectedMethod?.startsWith('ACCT:')
                                                ? allowedAccounts.find(a => `ACCT:${a.id}` === selectedMethod)?.name || 'Custom Account'
                                                : 'Other Account...'}
                                        </span>
                                    </button>

                                    {isAccountSelectOpen && (
                                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1E293B] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar flex flex-col">
                                            {allowedAccounts.map(account => (
                                                <button
                                                    key={account.id}
                                                    onClick={() => {
                                                        setSelectedMethod(`ACCT:${account.id}`);
                                                        setIsAccountSelectOpen(false);
                                                    }}
                                                    className="px-4 py-3 text-left border-b border-white/5 hover:bg-white/10 transition-colors flex items-center gap-3 last:border-0"
                                                >
                                                    <Landmark size={14} className="text-emerald-400" />
                                                    <span className="text-[11px] font-bold text-white uppercase tracking-wider">{account.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2b. Quick Actions: Reward Points / Wallet / Account */}
                    {client && client.id !== 1 && (
                        <div className="space-y-3">
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] block">Quick Apply</span>
                            <div className="grid grid-cols-1 gap-2">
                                {/* Reward Points */}
                                <button
                                    onClick={handleUseRewardPoints}
                                    disabled={(client.loyalty || 0) <= 0 || remaining <= 0}
                                    className={clsx(
                                        "h-16 rounded-2xl border flex items-center px-5 gap-4 transition-all group relative overflow-hidden",
                                        (client.loyalty || 0) > 0 && remaining > 0
                                            ? "bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/30 text-white hover:from-purple-600/40 hover:to-pink-600/40 hover:border-purple-400/50 active:scale-[0.98]"
                                            : "bg-white/5 border-white/5 text-white/15 cursor-not-allowed"
                                    )}
                                >
                                    <div className={clsx(
                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                        (client.loyalty || 0) > 0 ? "bg-purple-500/30 text-purple-300" : "bg-white/5 text-white/10"
                                    )}>
                                        <Gift size={20} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <span className="text-[10px] font-black uppercase tracking-widest block">Reward Points</span>
                                        <span className="text-xs font-bold text-white/40">{currency}{formatNumber(client.loyalty || 0)} available</span>
                                    </div>
                                    {(client.loyalty || 0) > 0 && remaining > 0 && (
                                        <div className="text-[9px] font-black text-purple-300 uppercase tracking-widest bg-purple-500/20 px-3 py-1.5 rounded-lg">Apply</div>
                                    )}
                                </button>

                                {/* Wallet Balance */}
                                <button
                                    onClick={handleUseWallet}
                                    disabled={(client.balance || 0) <= 0 || remaining <= 0}
                                    className={clsx(
                                        "h-16 rounded-2xl border flex items-center px-5 gap-4 transition-all group relative overflow-hidden",
                                        (client.balance || 0) > 0 && remaining > 0
                                            ? "bg-gradient-to-r from-amber-600/20 to-yellow-600/20 border-amber-500/30 text-white hover:from-amber-600/40 hover:to-yellow-600/40 hover:border-amber-400/50 active:scale-[0.98]"
                                            : "bg-white/5 border-white/5 text-white/15 cursor-not-allowed"
                                    )}
                                >
                                    <div className={clsx(
                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                        (client.balance || 0) > 0 ? "bg-amber-500/30 text-amber-300" : "bg-white/5 text-white/10"
                                    )}>
                                        <Wallet size={20} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <span className="text-[10px] font-black uppercase tracking-widest block">Client Wallet</span>
                                        <span className="text-xs font-bold text-white/40">{currency}{formatNumber(client.balance || 0)} available</span>
                                    </div>
                                    {(client.balance || 0) > 0 && remaining > 0 && (
                                        <div className="text-[9px] font-black text-amber-300 uppercase tracking-widest bg-amber-500/20 px-3 py-1.5 rounded-lg">Apply</div>
                                    )}
                                </button>

                                {/* Post to Account (Credit) */}
                                <button
                                    onClick={handleDeficitToAccount}
                                    disabled={remaining <= 0 || (remaining > availableCredit && client?.id !== 1)}
                                    className={clsx(
                                        "h-16 rounded-2xl border flex items-center px-5 gap-4 transition-all group relative overflow-hidden",
                                        remaining > 0 && (remaining <= availableCredit || client?.id === 1)
                                            ? "bg-gradient-to-r from-rose-600/20 to-red-600/20 border-rose-500/30 text-white hover:from-rose-600/40 hover:to-red-600/40 hover:border-rose-400/50 active:scale-[0.98]"
                                            : "bg-white/5 border-white/5 text-white/15 cursor-not-allowed"
                                    )}
                                >
                                    <div className={clsx(
                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                        remaining > 0 ? "bg-rose-500/30 text-rose-300" : "bg-white/5 text-white/10"
                                    )}>
                                        <UserPlus size={20} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <span className="text-[10px] font-black uppercase tracking-widest block">Post to Account</span>
                                        <span className="text-xs font-bold text-white/40">
                                            {remaining > availableCredit && client?.id !== 1
                                                ? `Limit exceeded (${currency}${formatNumber(availableCredit)})`
                                                : `${currency}${formatNumber(availableCredit)} credit left`}
                                        </span>
                                    </div>
                                    {remaining > 0 && (remaining <= availableCredit || client?.id === 1) && (
                                        <div className="text-[9px] font-black text-rose-300 uppercase tracking-widest bg-rose-500/20 px-3 py-1.5 rounded-lg">Apply</div>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 3. Numpad */}
                    <div className="space-y-3 flex-1 flex flex-col justify-end min-h-[300px]">
                        <div className="grid grid-cols-4 gap-2">
                            {['7', '8', '9', 'C', '4', '5', '6', 'X', '1', '2', '3', '.', '0'].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => handleNumpadAction(d)}
                                    className={clsx(
                                        "h-14 rounded-2xl font-black text-xl transition-all active:scale-90 flex items-center justify-center",
                                        d === 'C' ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white" :
                                            d === 'X' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-white" :
                                                "bg-white/5 text-white hover:bg-white/10 border border-white/5"
                                    )}
                                >
                                    {d === 'X' ? <ArrowLeft size={18} strokeWidth={3} /> : d}
                                </button>
                            ))}
                            <button
                                onClick={() => handleAddLeg()}
                                className="col-span-2 h-14 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-emerald-600 hover:shadow-2xl hover:shadow-emerald-500/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={18} strokeWidth={4} />
                                Add Entry
                            </button>
                        </div>
                    </div>
                </div>

                {/* ════ RIGHT COLUMN: LEDGER & STATUS (55%) ════ */}
                <div className="flex-1 flex flex-col p-8 space-y-8 overflow-y-auto custom-scrollbar">

                    {/* 1. Big Balance Status */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-2xl border border-slate-100 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-1">Current Ledger Balance</span>
                                <div className={clsx(
                                    "text-6xl font-black tabular-nums tracking-tighter transition-all duration-700",
                                    Math.abs(remaining) < 0.01 ? "text-emerald-500" :
                                        remaining < 0 ? "text-amber-500" : "text-rose-600"
                                )}>
                                    {currency}{formatNumber(remaining)}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] block mb-1">Value Paid</span>
                                <div className="text-3xl font-black text-slate-400 tabular-nums tracking-tight">
                                    {currency}{formatNumber(paidTotal)}
                                </div>
                            </div>
                        </div>

                        {/* Large Progress Bar */}
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden relative p-1">
                            <div
                                className={clsx(
                                    "h-full rounded-full transition-all duration-1000 ease-out relative",
                                    remaining <= 0.01 ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.5)]"
                                )}
                                style={{ width: `${Math.min(100, (paidTotal / totalAmount) * 100)}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                            </div>
                        </div>

                        {/* Resolvers */}
                        {remaining > 0.01 ? (
                            <div className="space-y-3">
                                {/* Deficit Warning */}
                                <div className={clsx(
                                    "p-5 rounded-2xl border flex items-center justify-between animate-in slide-in-from-right-4 duration-500",
                                    remaining > availableCredit && client?.id !== 1 ? "bg-red-50 border-red-200" : "bg-rose-50 border-rose-200"
                                )}>
                                    <div className="flex items-center gap-4">
                                        <div className={clsx(
                                            "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg",
                                            remaining > availableCredit && client?.id !== 1 ? "bg-red-600" : "bg-rose-600"
                                        )}>
                                            <AlertCircle size={24} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase text-slate-800 tracking-wider">
                                                {remaining > availableCredit && client?.id !== 1 ? "Credit Limit Reached" : "Balance Due"}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase text-slate-500 mt-0.5">
                                                {remaining > availableCredit && client?.id !== 1
                                                    ? `Limit: ${currency}${formatNumber(availableCredit)} | Required: ${currency}${formatNumber(remaining)}`
                                                    : `Unpaid amount must be accounted for`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleDeficitToAccount}
                                        disabled={remaining > availableCredit && client?.id !== 1}
                                        className={clsx(
                                            "h-12 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl shadow-rose-600/20",
                                            remaining > availableCredit && client?.id !== 1
                                                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                                                : "bg-rose-600 text-white hover:bg-rose-700 active:scale-95"
                                        )}
                                    >
                                        <UserPlus size={16} />
                                        Post to Credit
                                    </button>
                                </div>

                                {/* Round Off / Coin Discount */}
                                {remaining <= ROUND_OFF_MAX && remaining > 0.01 && (
                                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200 animate-in slide-in-from-right-4 duration-700">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                                <Percent size={20} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-indigo-900 uppercase tracking-wider">Round Off Discount</p>
                                                <p className="text-[10px] text-indigo-500 font-bold uppercase">Posts to Round-Off account for audit</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {[5, 10, 25, 50, 100].filter(r => {
                                                const disc = remaining - Math.floor(remaining / r) * r;
                                                return disc > 0 && disc <= ROUND_OFF_MAX;
                                            }).map(r => {
                                                const disc = remaining - Math.floor(remaining / r) * r;
                                                return (
                                                    <button
                                                        key={r}
                                                        onClick={() => handleRoundOff(r)}
                                                        className="h-10 px-4 bg-indigo-100 hover:bg-indigo-500 hover:text-white text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 border border-indigo-200 hover:border-indigo-500"
                                                    >
                                                        ↓{r} (-{currency}{formatNumber(disc)})
                                                    </button>
                                                );
                                            })}
                                            <button
                                                onClick={() => handleRoundOff()}
                                                className="h-10 px-4 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                                            >
                                                <Percent size={14} />
                                                Full (-{currency}{formatNumber(remaining)})
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : remaining < -0.01 ? (
                            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between animate-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
                                        <Coins size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-amber-900 uppercase tracking-wider">Surplus Detected</p>
                                        <p className="text-[10px] text-amber-600 font-bold uppercase mt-0.5">Overage: {currency}{formatNumber(Math.abs(remaining))}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleSurplusToWallet}
                                    className="h-12 px-6 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all flex items-center gap-3 shadow-xl shadow-amber-600/20 active:scale-95"
                                >
                                    <Wallet size={16} />
                                    Add to Wallet
                                </button>
                            </div>
                        ) : (
                            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-4 animate-in zoom-in-95 duration-500">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-emerald-900 uppercase tracking-wider">Perfectly Balanced</p>
                                    <p className="text-[10px] text-emerald-600 font-bold uppercase mt-0.5">Ready to finalize the transaction.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. Payment History / Legs */}
                    <div className="flex-1 flex flex-col space-y-3 min-h-0">
                        <div className="flex items-center justify-between px-2">
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Payment Applied</span>
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{paymentLegs.length} Entries</span>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {paymentLegs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-white/5 border-2 border-dashed border-white/5 rounded-3xl">
                                    <Calculator size={48} strokeWidth={1} />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] italic mt-3">Waiting for first entry...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {paymentLegs.map((leg, idx) => {
                                        const Icon = getMethodIcon(leg.method);
                                        return (
                                            <div
                                                key={idx}
                                                className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 hover:border-emerald-500/50 transition-all group animate-in slide-in-from-bottom-2"
                                            >
                                                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white group-hover:text-emerald-400 transition-colors">
                                                    <Icon size={24} />
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest block">{leg.method}</span>
                                                    <span className="text-2xl font-black text-white tabular-nums tracking-tighter">
                                                        {currency}{formatNumber(leg.amount)}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const removedLeg = paymentLegs[idx];
                                                        setPaymentLegs(prev => prev.filter((_, i) => i !== idx));
                                                        // Re-enable the special method for re-application
                                                        setAppliedSpecials(prev => {
                                                            const next = new Set(prev);
                                                            next.delete(removedLeg.method);
                                                            return next;
                                                        });
                                                    }}
                                                    className="w-10 h-10 rounded-xl bg-white/5 text-white/20 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. Global Action Button */}
                    <div className="pt-4 border-t border-white/5">
                        <button
                            onClick={() => onConfirm(paymentLegs)}
                            disabled={Math.abs(remaining) > 0.01 || paymentLegs.length === 0 || isProcessing}
                            className={clsx(
                                "w-full h-24 rounded-3xl flex items-center justify-center gap-6 transition-all relative overflow-hidden group shadow-2xl",
                                Math.abs(remaining) <= 0.01 && paymentLegs.length > 0 && !isProcessing
                                    ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-emerald-500/40 hover:scale-[1.01] active:scale-95"
                                    : "bg-white/5 text-white/10 cursor-not-allowed border border-white/5"
                            )}
                        >
                            {Math.abs(remaining) <= 0.01 && !isProcessing && (
                                <div className="absolute inset-0 bg-white/10 animate-pulse" />
                            )}
                            <div className={clsx(
                                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700",
                                Math.abs(remaining) <= 0.01 ? "bg-white/20 scale-110 shadow-lg shadow-white/10" : "bg-white/5"
                            )}>
                                <Check size={32} strokeWidth={4} className={clsx("transition-transform duration-700", Math.abs(remaining) <= 0.01 ? "rotate-0 scale-100" : "rotate-45 scale-50")} />
                            </div>
                            <div className="text-left">
                                <span className="text-[11px] font-black uppercase tracking-[0.3em] block mb-0.5">Confirmation</span>
                                <span className="text-xl font-black uppercase tracking-widest">Finalize & Close Sale</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Keep the old component for backward compatibility if needed by other layouts, 
// though we aim to use the Inline dashboard in layouts now.
export function MultiPaymentHub({
    isOpen,
    onClose,
    totalAmount,
    currency,
    paymentMethods,
    client,
    onConfirm,
    isProcessing
}: any) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 md:p-8">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-300" onClick={onClose} />
            <div className="relative w-full max-w-4xl h-[90vh] max-h-[850px] bg-[#0F172A] rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                <MultiPaymentDashboard
                    totalAmount={totalAmount}
                    currency={currency}
                    paymentMethods={paymentMethods}
                    client={client}
                    onConfirm={onConfirm}
                    onCancel={onClose}
                    isProcessing={isProcessing}
                />
            </div>
        </div>
    );
}
