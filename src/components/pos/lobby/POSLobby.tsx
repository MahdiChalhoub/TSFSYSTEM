'use client';

/**
 * POSLobby — Premium Split-Panel Redesign
 * =========================================
 * Flow: Site → Register → Who's Working? → PIN → Open
 * Left: Dynamic org brand panel + live clock
 * Right: Step wizard with glassmorphic cards
 */

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
    Building2, Monitor, Lock, Unlock, User, ChevronRight, Clock,
    ArrowLeft, Shield, Loader2, Banknote, CreditCard, Smartphone,
    AlertCircle, CheckCircle2, Zap, BarChart3, ArrowRightLeft,
    Settings2, Delete, DollarSign, MapPin
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';

// ─── Types ───────────────────────────────────────────────────────

interface RegisterUser { id: number; name: string; username: string; hasPin: boolean; }
interface RegisterAccount { id: number; name: string; type: string; }
interface RegisterSession { id: number; cashierId: number; cashierName: string; openedAt: string; openingBalance: number; }
interface Register {
    id: number; name: string; isOpen: boolean; currentSession: RegisterSession | null;
    cashAccountId: number | null; cashAccountName: string | null;
    warehouseId: number | null; warehouseName: string | null;
    allowedAccounts: RegisterAccount[]; authorizedUsers: RegisterUser[];
    openingMode?: string; cashierCanSeeSoftware?: boolean;
    paymentMethods?: Array<{ key: string; label: string; accountId: number | null }>;
}
interface Site { id: number; name: string; code: string; address: string; registers: Register[]; }
interface POSLobbyProps {
    currency: string;
    onEnterPOS: (config: {
        registerId: number; registerName: string; sessionId: number;
        cashierId: number; cashierName: string; warehouseId: number | null;
        cashAccountId: number | null; allowedAccounts: RegisterAccount[];
        siteName: string; paymentMethods: Array<{ key: string; label: string; accountId: number | null }>;
    }) => void;
}
type LobbyStep = 'site' | 'register' | 'user' | 'pin' | 'opening';

// ─── Step Progress Bar ───────────────────────────────────────────
const STEPS: { key: LobbyStep; label: string }[] = [
    { key: 'site', label: 'Site' },
    { key: 'register', label: 'Register' },
    { key: 'user', label: "Who's Working" },
    { key: 'pin', label: 'PIN' },
    { key: 'opening', label: 'Open' },
];

function StepProgress({ current }: { current: LobbyStep }) {
    const currentIdx = STEPS.findIndex(s => s.key === current);
    return (
        <div className="flex items-center justify-center gap-1.5 mb-8">
            {STEPS.map((s, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                return (
                    <div key={s.key} className="flex items-center gap-1.5">
                        {i > 0 && (
                            <div className={clsx('h-px w-5 transition-all duration-500', done ? 'bg-[var(--app-primary)]' : 'bg-[var(--app-surface-hover)]')} />
                        )}
                        <div className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black transition-all duration-300',
                            active && 'bg-[var(--app-primary-light)] text-[var(--app-primary)] ring-1 ring-[var(--app-primary-strong)]/50 shadow-lg shadow-[var(--app-primary-glow)]',
                            done && 'bg-[var(--app-success-bg)] text-[var(--app-success)]',
                            !active && !done && 'text-[var(--app-text-faint)]',
                        )}>
                            {done ? <CheckCircle2 size={10} /> : <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">{i + 1}</span>}
                            <span className={clsx(!active && !done && 'hidden sm:inline')}>{s.label}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Step 1: Site ────────────────────────────────────────────────
const SiteStep = memo(function SiteStep({ sites, onSelect }: { sites: Site[]; onSelect: (s: Site) => void }) {
    return (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="text-center mb-7">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--app-primary-light)] border border-[var(--app-primary-strong)]/20 mb-4">
                    <MapPin size={12} className="text-[var(--app-primary)]" />
                    <span className="text-[11px] font-black text-[var(--app-primary)] uppercase tracking-widest">Select Location</span>
                </div>
                <h2 className="text-3xl font-black text-[var(--app-text)] mb-1">Where are you working?</h2>
                <p className="text-[var(--app-text-muted)] text-sm">Choose the site for this session</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sites.map(site => {
                    const hasRegs = site.registers.length > 0;
                    const hasActive = site.registers.some(r => r.isOpen);
                    return (
                        <button
                            key={site.id}
                            onClick={() => hasRegs ? onSelect(site) : toast.info(`"${site.name}" has no registers.`)}
                            className={clsx(
                                'group relative p-5 rounded-2xl border text-left transition-all duration-200 active:scale-[0.97]',
                                hasRegs
                                    ? 'bg-[var(--app-surface)] border-[var(--app-border)] hover:border-[var(--app-primary-strong)]/50 hover:bg-[var(--app-primary-light)]'
                                    : 'bg-[var(--app-surface-2)] border-[var(--app-border)]/50 opacity-50 cursor-default'
                            )}
                        >
                            {hasRegs && <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--app-primary)]/0 to-[var(--app-primary-glow)]/0 group-hover:from-[var(--app-primary)]/10 group-hover:to-[var(--app-primary-glow)]/10 transition-all duration-300" />}
                            <div className="relative">
                                <div className={clsx(
                                    'w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-all',
                                    hasRegs ? 'bg-[var(--app-primary-light)] text-[var(--app-primary)] group-hover:bg-[var(--app-primary)] group-hover:text-white' : 'bg-[var(--app-surface-hover)] text-[var(--app-text-faint)]'
                                )}>
                                    <Building2 size={20} />
                                </div>
                                <h3 className="font-black text-[var(--app-text)] text-base leading-tight">{site.name}</h3>
                                {site.code && <p className="text-[var(--app-text-faint)] text-xs font-mono mt-0.5">{site.code}</p>}
                                {site.address && <p className="text-[var(--app-text-faint)] text-xs mt-1 line-clamp-1">{site.address}</p>}
                                <div className="flex items-center gap-2 mt-3">
                                    {hasRegs ? (
                                        <>
                                            <span className="px-2 py-0.5 rounded-full bg-[var(--app-surface-hover)] text-[var(--app-text-muted)] text-[10px] font-bold">
                                                {site.registers.length} register{site.registers.length !== 1 ? 's' : ''}
                                            </span>
                                            {hasActive && (
                                                <span className="px-2 py-0.5 rounded-full bg-[var(--app-success-bg)] text-[var(--app-success)] text-[10px] font-black animate-pulse">
                                                    ● Live
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-[var(--app-warning-bg)] text-[var(--app-warning)]/60 text-[10px] font-bold">No registers</span>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {sites.length === 0 && (
                <div className="text-center py-16 border border-[var(--app-border)]/50 rounded-2xl bg-[var(--app-surface-2)]">
                    <AlertCircle size={40} className="text-[var(--app-text-faint)]/50 mx-auto mb-3" />
                    <p className="text-[var(--app-text-muted)] font-bold">No sites configured</p>
                    <p className="text-[var(--app-text-faint)] text-sm mt-1">Create sites in POS Settings</p>
                </div>
            )}
        </div>
    );
});

// ─── Step 2: Register ────────────────────────────────────────────
const RegisterStep = memo(function RegisterStep({ site, onSelect }: { site: Site; onSelect: (r: Register) => void }) {
    return (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="text-center mb-7">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--app-primary-light)] border border-[var(--app-primary-strong)]/20 mb-4">
                    <Monitor size={12} className="text-[var(--app-primary)]" />
                    <span className="text-[11px] font-black text-[var(--app-primary)] uppercase tracking-widest">{site.name}</span>
                </div>
                <h2 className="text-3xl font-black text-[var(--app-text)] mb-1">Select Register</h2>
                <p className="text-[var(--app-text-muted)] text-sm">Choose your workstation</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {site.registers.map(reg => (
                    <button
                        key={reg.id}
                        onClick={() => onSelect(reg)}
                        className={clsx(
                            'group relative p-5 rounded-2xl border text-left transition-all duration-200 active:scale-[0.97]',
                            reg.isOpen
                                ? 'bg-[var(--app-success-bg)] border-[var(--app-success)]/30 hover:border-[var(--app-success)]/60'
                                : 'bg-[var(--app-surface)] border-[var(--app-border)] hover:border-[var(--app-primary-strong)]/50 hover:bg-[var(--app-primary-light)]'
                        )}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className={clsx(
                                'w-11 h-11 rounded-xl flex items-center justify-center transition-all',
                                reg.isOpen ? 'bg-[var(--app-success-bg)] text-[var(--app-success)]' : 'bg-[var(--app-surface-hover)] text-[var(--app-text-muted)] group-hover:bg-indigo-400 group-hover:text-[var(--app-text)]'
                            )}>
                                <Monitor size={20} />
                            </div>
                            {reg.isOpen
                                ? <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--app-success-bg)] text-[var(--app-success)] text-[10px] font-black"><Unlock size={9} /> OPEN</span>
                                : <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--app-surface-hover)] text-[var(--app-text-faint)] text-[10px] font-black"><Lock size={9} /> CLOSED</span>
                            }
                        </div>
                        <h3 className="font-black text-[var(--app-text)] text-base">{reg.name}</h3>
                        {reg.isOpen && reg.currentSession && (
                            <div className="mt-2 space-y-0.5">
                                <p className="text-[var(--app-success)]/80 text-xs font-bold flex items-center gap-1"><User size={10} />{reg.currentSession.cashierName}</p>
                                <p className="text-[var(--app-text-faint)] text-[10px] flex items-center gap-1"><Clock size={10} />Since {new Date(reg.currentSession.openedAt).toLocaleTimeString()}</p>
                            </div>
                        )}
                        {reg.allowedAccounts.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                                {reg.allowedAccounts.slice(0, 3).map(a => (
                                    <span key={a.id} className="px-1.5 py-0.5 rounded bg-[var(--app-surface-hover)] text-[var(--app-text-faint)] text-[9px] font-bold">{a.name}</span>
                                ))}
                                {reg.allowedAccounts.length > 3 && <span className="px-1.5 py-0.5 rounded bg-[var(--app-surface-hover)] text-[var(--app-text-faint)] text-[9px]">+{reg.allowedAccounts.length - 3}</span>}
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {site.registers.length === 0 && (
                <div className="text-center py-16 border border-[var(--app-border)]/50 rounded-2xl bg-[var(--app-surface-2)]">
                    <Monitor size={40} className="text-[var(--app-text-faint)]/50 mx-auto mb-3" />
                    <p className="text-[var(--app-text-muted)] font-bold">No registers at this site</p>
                </div>
            )}
        </div>
    );
});

// ─── Step 3: Who's Working ───────────────────────────────────────
const UserStep = memo(function UserStep({ register, onSelect }: { register: Register; onSelect: (u: RegisterUser) => void }) {
    return (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-[var(--app-info-bg)] border border-[var(--app-info)]/30 text-[var(--app-info)] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-sm shadow-[var(--app-info)]/20">
                    <User size={36} />
                </div>
                <h2 className="text-3xl font-black text-[var(--app-text)] mb-1">Who&apos;s working?</h2>
                <p className="text-[var(--app-text-muted)] text-sm">{register.name} — tap your name to continue</p>
            </div>

            {register.authorizedUsers.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {register.authorizedUsers.map(u => (
                        <button
                            key={u.id}
                            onClick={() => onSelect(u)}
                            className="group p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-info)]/50 hover:bg-[var(--app-info-bg)] transition-all duration-200 text-center active:scale-[0.97]"
                        >
                            <div className="w-16 h-16 rounded-full bg-[var(--app-info-bg)] text-[var(--app-info)] flex items-center justify-center mx-auto mb-3 font-black text-xl group-hover:bg-[var(--app-info)] group-hover:text-[var(--app-text)] transition-all shadow-lg">
                                {u.name?.substring(0, 2).toUpperCase()}
                            </div>
                            <p className="text-sm font-black text-[var(--app-text)]">{u.name}</p>
                            {!u.hasPin && (
                                <p className="text-[10px] text-[var(--app-warning)] mt-1.5 flex items-center justify-center gap-1">
                                    <AlertCircle size={9} /> No PIN set
                                </p>
                            )}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 border border-[var(--app-border)]/50 rounded-2xl bg-[var(--app-surface-2)]">
                    <AlertCircle size={36} className="text-[var(--app-text-faint)] mx-auto mb-3" />
                    <p className="text-[var(--app-text-muted)] font-bold">No cashiers assigned</p>
                    <p className="text-[var(--app-text-faint)] text-sm mt-1">Assign users in POS Configuration</p>
                </div>
            )}
        </div>
    );
});

// ─── Step 4: PIN ─────────────────────────────────────────────────
const PinStep = memo(function PinStep({ register, cashier, onVerified }: {
    register: Register;
    cashier: RegisterUser;
    onVerified: (user: { id: number; name: string; username: string }) => void;
}) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [shake, setShake] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);

    const handleSubmit = async (p = pin) => {
        if (p.length < 4) return;
        setLoading(true); setError('');
        try {
            const { verifyPosPin } = await import('@/components/pos/register-actions');
            const result = await verifyPosPin(register.id, p, cashier.id);
            if (result.success && result.data?.valid) {
                toast.success(`Welcome, ${result.data.user.name}!`);
                onVerified(result.data.user);
            } else {
                setShake(true); setTimeout(() => setShake(false), 500);
                setError('Incorrect PIN — try again');
                setPin('');
            }
        } catch { setError('Auth engine fault'); }
        setLoading(false);
    };

    const press = (key: string) => {
        if (loading) return;
        if (key === 'DEL') { setPin(p => p.slice(0, -1)); setError(''); }
        else if (key === '✓') { handleSubmit(); }
        else if (pin.length < 6) {
            const next = pin + key;
            setPin(next); setError('');
            if (next.length === 6) setTimeout(() => handleSubmit(next), 80);
        }
    };

    const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', '✓'];

    return (
        <div className={clsx('w-full max-w-sm animate-in fade-in zoom-in-95 duration-400', shake && 'animate-shake')}>
            {/* Avatar */}
            <div className="text-center mb-7">
                <div className="w-20 h-20 rounded-full bg-[var(--app-primary-light)] border border-[var(--app-primary-strong)]/30 text-[var(--app-primary)] flex items-center justify-center mx-auto mb-3 font-black text-2xl shadow-xl shadow-[var(--app-primary-glow)]">
                    {cashier.name.substring(0, 2).toUpperCase()}
                </div>
                <h2 className="text-2xl font-black text-[var(--app-text)]">{cashier.name}</h2>
                <p className="text-[var(--app-text-muted)] text-sm mt-0.5">{register.name}</p>
            </div>

            {/* PIN dots */}
            <div className={clsx('flex justify-center gap-3 mb-5', shake && 'animate-bounce')}>
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={clsx(
                        'w-4 h-4 rounded-full border-2 transition-all duration-150',
                        i < pin.length ? 'bg-[var(--app-primary)] border-[var(--app-primary-strong)] shadow-lg shadow-[var(--app-primary-glow)] scale-110' : 'border-[var(--app-border)]/80 bg-transparent'
                    )} />
                ))}
            </div>

            {error && (
                <div className="flex items-center justify-center gap-2 text-[var(--app-error)] text-xs font-bold mb-4">
                    <AlertCircle size={13} /> {error}
                </div>
            )}

            <input ref={inputRef} type="password" inputMode="numeric" maxLength={6} value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && pin.length >= 4) handleSubmit(); if (e.key === 'Backspace') setPin(p => p.slice(0, -1)); }}
                className="sr-only" autoFocus
            />

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
                {KEYS.map(key => (
                    <button
                        key={key}
                        onClick={() => press(key)}
                        disabled={loading}
                        className={clsx(
                            'h-14 rounded-2xl font-black text-lg transition-all duration-100 active:scale-90 select-none',
                            key === '✓'
                                ? pin.length >= 4
                                    ? 'bg-gradient-to-br from-[var(--app-primary)] to-teal-500 text-white shadow-xl shadow-[var(--app-primary-glow)] hover:shadow-[var(--app-primary-glow)]'
                                    : 'bg-[var(--app-surface-hover)] text-[var(--app-text-faint)] cursor-not-allowed'
                                : key === 'DEL'
                                    ? 'bg-[var(--app-error-bg)] text-[var(--app-error)] hover:bg-[var(--app-error-bg)]'
                                    : 'bg-[var(--app-surface-hover)] text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)]/50'
                        )}
                    >
                        {loading && key === '✓' ? <Loader2 size={18} className="animate-spin mx-auto" /> : key === 'DEL' ? <Delete size={18} className="mx-auto" /> : key}
                    </button>
                ))}
            </div>
        </div>
    );
});

// ─── Step 5: Open Register ───────────────────────────────────────
const OpeningStep = memo(function OpeningStep({ register, site, verifiedUser, currency, onEnterPOS }: {
    register: Register; site: Site;
    verifiedUser: { id: number; name: string; username: string };
    currency: string; onEnterPOS: POSLobbyProps['onEnterPOS'];
}) {
    const [openingBalance, setOpeningBalance] = useState('0');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [openingMode] = useState<'standard' | 'advanced'>(register.openingMode === 'advanced' ? 'advanced' : 'standard');
    const [managerUnlocked, setManagerUnlocked] = useState(register.cashierCanSeeSoftware === true);
    const [reconEntries, setReconEntries] = useState<Array<{ account_id: number; name: string; type: string; software: string; real: string }>>([]);
    const [cashSoftware, setCashSoftware] = useState('0');
    const [cashReal, setCashReal] = useState('0');
    const [accountBookBalance, setAccountBookBalance] = useState('0');
    const [accountBookLive, setAccountBookLive] = useState<number | null>(null);
    const [sessionConflict, setSessionConflict] = useState<{ cashierName: string; sessionId: number } | null>(null);
    const [forceClosePin, setForceClosePin] = useState('');
    const [forceCloseLoading, setForceCloseLoading] = useState(false);

    // Fetch live account book balance and ledger software balances on mount
    useEffect(() => {
        const init = async () => {
            const { getAccountBookBalance, getRegisterAccountBalances } = await import('@/components/pos/register-actions');

            // 1. Fetch account book live balance
            const abResult = await getAccountBookBalance(register.id).catch(() => null);
            if (abResult?.success && typeof abResult.balance === 'number') {
                setAccountBookLive(abResult.balance);
                setAccountBookBalance(String(abResult.balance));
            }

            // 2. Fetch all account software balances (for advanced recon)
            if (openingMode === 'advanced') {
                const balResult = await getRegisterAccountBalances(register.id).catch(() => null);
                const balMap: Record<number, number> = {};
                if (balResult?.success && balResult.data) {
                    balResult.data.forEach(acc => { balMap[acc.accountId] = acc.softwareBalance; });
                }

                // Build recon entries with software balance pre-filled from ledger
                const entries = register.allowedAccounts
                    .filter(a => a.type !== 'CASH')
                    .map(a => ({
                        account_id: a.id, name: a.name, type: a.type,
                        software: String(balMap[a.id] ?? 0),
                        real: '0',
                    }));
                setReconEntries(entries);

                // Pre-fill cash software from ledger too
                const cashAcc = balResult?.data?.find(a => a.isCashAccount);
                if (cashAcc) setCashSoftware(String(cashAcc.softwareBalance));
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [register.id, openingMode]);


    const buildAdvanced = () => openingMode === 'advanced' && reconEntries.length > 0 ? {
        opening_mode: 'advanced' as const,
        account_reconciliations: reconEntries.map(e => ({ account_id: e.account_id, software_amount: parseFloat(e.software) || 0, statement_amount: parseFloat(e.real) || 0 })),
        cash_counted: parseFloat(cashReal) || 0, cash_software: parseFloat(cashSoftware) || 0, account_book_balance: parseFloat(accountBookBalance) || 0,
    } : undefined;

    const handleOpen = async () => {
        setLoading(true);
        try {
            const { openRegisterSession } = await import('@/components/pos/register-actions');
            const result = await openRegisterSession(register.id, verifiedUser.id, parseFloat(openingBalance) || 0, notes, buildAdvanced());
            if (result.success && result.data) {
                toast.success(result.data.message || 'Session initialized');
                onEnterPOS({ registerId: register.id, registerName: register.name, sessionId: result.data.session_id, cashierId: verifiedUser.id, cashierName: verifiedUser.name, warehouseId: result.data.warehouse_id || register.warehouseId, cashAccountId: result.data.cash_account_id || register.cashAccountId, allowedAccounts: result.data.allowed_accounts || register.allowedAccounts || [], siteName: site.name, paymentMethods: result.data.payment_methods || register.paymentMethods || [] });
            } else {
                const code = result.data?.error_code;
                if (code === 'SESSION_OPEN') setSessionConflict({ cashierName: result.data?.current_cashier || 'another cashier', sessionId: result.data?.current_session_id });
                else if (code === 'NO_FISCAL_YEAR') toast.error('No open fiscal year — check Finance settings', { duration: 6000 });
                else if (code === 'NO_PAYMENT_ACCOUNTS') toast.error('No payment accounts linked', { duration: 6000 });
                else toast.error(result.error || 'Opening fault');
            }
        } catch (e: any) { toast.error('Connection fault: ' + (e.message || 'Unknown')); }
        setLoading(false);
    };

    const handleForceClose = async () => {
        if (forceClosePin.length < 4) { toast.error('Enter manager PIN'); return; }
        setForceCloseLoading(true);
        try {
            const { openRegisterSession } = await import('@/components/pos/register-actions');
            const result = await openRegisterSession(register.id, verifiedUser.id, parseFloat(openingBalance) || 0, notes, buildAdvanced(), true, forceClosePin);
            if (result.success && result.data) {
                setSessionConflict(null); setForceClosePin(''); toast.success(result.data.message);
                onEnterPOS({ registerId: register.id, registerName: register.name, sessionId: result.data.session_id, cashierId: verifiedUser.id, cashierName: verifiedUser.name, warehouseId: result.data.warehouse_id, cashAccountId: result.data.cash_account_id, allowedAccounts: result.data.allowed_accounts || register.allowedAccounts, siteName: site.name, paymentMethods: register.paymentMethods || [] });
            } else if (result.data?.error_code === 'INVALID_OVERRIDE_PIN') toast.error('Wrong manager PIN');
            else toast.error(result.error || 'Force close failed');
        } catch { toast.error('Connection fault'); }
        setForceCloseLoading(false);
    };

    const cashSW = parseFloat(cashSoftware) || 0;
    const cashRL = parseFloat(cashReal) || 0;
    const totalCalibration = reconEntries.reduce((s, e) => s + ((parseFloat(e.real) || 0) - (parseFloat(e.software) || 0)), 0);
    const cashExpected = cashSW - totalCalibration;
    const cashGap = cashRL - cashExpected;
    const abBal = parseFloat(accountBookBalance) || 0;
    const finalGap = cashGap - abBal;

    return (
        <div className={clsx('w-full animate-in fade-in slide-in-from-bottom-4 duration-400', openingMode === 'advanced' ? 'max-w-2xl' : 'max-w-md')}>
            {/* Session conflict banner */}
            {sessionConflict && (
                <div className="mb-5 bg-[var(--app-warning-bg)] border border-[var(--app-warning)]/30 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle size={20} className="text-[var(--app-warning)] shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[var(--app-warning)] font-black text-sm">Register In Use</p>
                            <p className="text-amber-200/60 text-xs mt-1">Opened by <span className="font-bold text-amber-200">{sessionConflict.cashierName}</span>. Use manager override to force close.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <input type="password" inputMode="numeric" value={forceClosePin} onChange={e => setForceClosePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Manager PIN" maxLength={6}
                            className="flex-1 px-4 py-2.5 bg-black/30 border border-[var(--app-warning)]/30 rounded-xl text-sm font-mono font-bold text-amber-100 outline-none focus:ring-2 focus:ring-amber-400/30 tracking-[0.3em] text-center" />
                        <button onClick={handleForceClose} disabled={forceCloseLoading || forceClosePin.length < 4}
                            className="px-4 py-2.5 bg-[var(--app-warning)] text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center gap-2">
                            {forceCloseLoading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />} Force Close
                        </button>
                    </div>
                </div>
            )}

            <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-[var(--app-success-bg)] border border-[var(--app-success)]/30 text-[var(--app-success)] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-sm shadow-[var(--app-success)]/20">
                    <CheckCircle2 size={30} />
                </div>
                <h2 className="text-2xl font-black text-[var(--app-text)]">Open Register</h2>
                <p className="text-[var(--app-text-muted)] text-sm mt-0.5">{register.name} · {verifiedUser.name}</p>
            </div>

            {/* Already open by this user */}
            {register.isOpen && register.currentSession && (
                <div className="bg-[var(--app-warning-bg)] border border-amber-400/25 rounded-2xl p-4 mb-4 text-center">
                    <p className="text-[var(--app-warning)] text-sm font-bold">⚠ Register currently open</p>
                    <p className="text-amber-200/50 text-xs mt-1">By {register.currentSession.cashierName}</p>
                    <button onClick={() => onEnterPOS({ registerId: register.id, registerName: register.name, sessionId: register.currentSession!.id, cashierId: verifiedUser.id, cashierName: verifiedUser.name, warehouseId: register.warehouseId, cashAccountId: register.cashAccountId, allowedAccounts: register.allowedAccounts, siteName: site.name, paymentMethods: register.paymentMethods || [] })}
                        className="mt-3 px-6 py-2 rounded-xl bg-[var(--app-warning)] text-white font-bold text-sm">
                        Enter Existing Session →
                    </button>
                </div>
            )}

            {!register.isOpen && (
                <>
                    {openingMode === 'standard' ? (
                        <div className="bg-[var(--app-surface)] rounded-2xl p-6 border border-white/8 space-y-4">
                            <div>
                                <label className="text-[10px] text-white/35 uppercase tracking-widest font-black block mb-1.5">Opening Cash ({currency})</label>
                                <div className="relative">
                                    <Banknote size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--app-text-faint)]" />
                                    <input type="number" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3.5 bg-[var(--app-surface-hover)] border border-[var(--app-border)] rounded-xl text-[var(--app-text)] text-2xl font-black outline-none focus:border-[var(--app-primary-strong)]/50 focus:ring-4 focus:ring-cyan-400/10 transition-all" placeholder="0.00" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-white/35 uppercase tracking-widest font-black block mb-1.5">Shift Notes</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-[var(--app-surface-hover)] border border-[var(--app-border)] rounded-xl text-[var(--app-text)] text-sm outline-none focus:border-[var(--app-primary-strong)]/50 resize-none h-16" placeholder="Optional notes..." />
                            </div>
                            <button onClick={handleOpen} disabled={loading}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-[var(--app-primary)] via-teal-400 to-emerald-500 text-white font-black text-lg shadow-2xl shadow-cyan-400/25 hover:shadow-cyan-400/40 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                                {loading ? <Loader2 size={22} className="animate-spin" /> : <><Unlock size={22} /> Open & Start Selling</>}
                            </button>
                        </div>
                    ) : (
                        /* Advanced reconciliation — keep existing layout, just update styles */
                        <div className="bg-[var(--app-surface)] rounded-2xl p-6 border border-violet-500/20 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={14} className="text-[var(--app-info)]" />
                                    <span className="text-[10px] text-[var(--app-info)] uppercase tracking-widest font-black">Advanced Reconciliation</span>
                                </div>
                                {!managerUnlocked && (
                                    <button onClick={() => setManagerUnlocked(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-bold text-[var(--app-text-muted)] hover:text-[var(--app-warning)] hover:border-[var(--app-warning)]/30 transition-all">
                                        <Lock size={11} /> Show Details
                                    </button>
                                )}
                                {managerUnlocked && <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--app-success)]/10 border border-emerald-400/20 text-xs font-bold text-[var(--app-success)]"><Unlock size={11} /> Full View</span>}
                            </div>

                            <div className={clsx('grid gap-2 text-[9px] text-[var(--app-text-faint)] uppercase tracking-wider font-bold px-1', managerUnlocked ? 'grid-cols-[1fr_90px_90px_70px_80px]' : 'grid-cols-[1fr_110px]')}>
                                <span>Method</span>
                                {managerUnlocked && <span className="text-center">Software</span>}
                                <span className="text-center">{managerUnlocked ? 'Real' : 'Balance'}</span>
                                {managerUnlocked && <span className="text-center">→ Cash</span>}
                                {managerUnlocked && <span className="text-center">Action</span>}
                            </div>

                            {/* ── CASH row FIRST ── */}
                            <div className={clsx('grid gap-2 items-center p-1.5 rounded-xl', managerUnlocked ? 'grid-cols-[1fr_90px_90px_70px_80px] bg-[var(--app-success)]/5 border border-emerald-400/15' : 'grid-cols-[1fr_110px]')}>
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-[var(--app-success-bg)] text-[var(--app-success)] flex items-center justify-center"><Banknote size={11} /></span>
                                    <span className="text-xs font-black text-[var(--app-success)]">CASH</span>
                                </div>
                                {managerUnlocked && <input type="number" value={cashSoftware} onChange={e => setCashSoftware(e.target.value)} className="w-full px-2 py-1.5 bg-[var(--app-surface-hover)] border border-[var(--app-border)] rounded-lg text-[var(--app-text)] text-xs font-bold text-center outline-none focus:border-emerald-400" />}
                                <input type="number" value={cashReal} onChange={e => setCashReal(e.target.value)} className="w-full px-2 py-1.5 bg-[var(--app-success)]/10 border border-emerald-400/20 rounded-lg text-emerald-300 text-xs font-bold text-center outline-none" />
                                {managerUnlocked && (() => {
                                    const diff = (parseFloat(cashReal) || 0) - (parseFloat(cashSoftware) || 0);
                                    return <span className={clsx('text-xs font-black text-center', diff > 0 ? 'text-[var(--app-success)]' : diff < 0 ? 'text-[var(--app-error)]' : 'text-[var(--app-text-faint)]')}>{diff > 0 ? '+' : ''}{diff !== 0 ? diff.toFixed(0) : '—'}</span>;
                                })()}
                                {managerUnlocked && (() => {
                                    const diff = (parseFloat(cashReal) || 0) - (parseFloat(cashSoftware) || 0);
                                    return diff !== 0 ? (
                                        <button onClick={() => setCashSoftware(cashReal)}
                                            className="flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-[var(--app-warning)]/15 border border-amber-400/25 text-[var(--app-warning)] text-[10px] font-bold hover:bg-[var(--app-warning)]/25 transition-all">
                                            ⇄ Calibrate
                                        </button>
                                    ) : <span className="text-[10px] text-[var(--app-success)]/50 text-center font-bold">✓ OK</span>;
                                })()}
                            </div>

                            {/* ── Account Book row — read-only, sourced from CashierAddressBook ledger ── */}
                            <div className={clsx('grid gap-2 items-center rounded-xl px-1.5 py-1 bg-[var(--app-warning)]/5 border border-amber-400/10', managerUnlocked ? 'grid-cols-[1fr_90px_90px_70px_80px]' : 'grid-cols-[1fr_110px]')}>
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-[var(--app-warning)]/20 text-[var(--app-warning)] flex items-center justify-center"><DollarSign size={11} /></span>
                                    <div>
                                        <span className="text-xs font-black text-[var(--app-warning)]">Account Book</span>
                                        {accountBookLive !== null
                                            ? <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--app-success-bg)] text-[var(--app-success)] font-bold">↻ Live</span>
                                            : <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--app-surface-hover)] text-[var(--app-text-faint)] font-bold">No session</span>
                                        }
                                    </div>
                                </div>
                                {managerUnlocked && <span className="text-[var(--app-text-faint)] text-xs text-center">—</span>}
                                {/* Read-only display — value comes from CashierAddressBook API */}
                                <div className="w-full px-2 py-1.5 bg-[var(--app-warning-bg)] border border-[var(--app-warning)]/20 rounded-lg text-[var(--app-warning)] text-xs font-bold text-center select-all">
                                    {parseFloat(accountBookBalance) !== 0
                                        ? parseFloat(accountBookBalance).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                                        : '0'}
                                </div>
                                {managerUnlocked && <span className="text-[var(--app-text-faint)] text-xs text-center">—</span>}
                                {managerUnlocked && <span />}
                            </div>

                            {/* ── Divider before non-cash payment accounts ── */}
                            {reconEntries.length > 0 && (
                                <div className="flex items-center gap-2 pt-1">
                                    <div className="flex-1 h-px bg-[var(--app-surface-hover)]" />
                                    <span className="text-[9px] text-[var(--app-text-faint)] uppercase tracking-widest font-bold">Payment Accounts</span>
                                    <div className="flex-1 h-px bg-[var(--app-surface-hover)]" />
                                </div>
                            )}

                            {/* ── Other (non-cash) payment accounts ── */}
                            {reconEntries.map((entry, idx) => {
                                const sw = parseFloat(entry.software) || 0;
                                const rl = parseFloat(entry.real) || 0;
                                const cal = -(sw - rl); // positive = cash gets more
                                const diff = rl - sw;
                                return (
                                    <div key={entry.account_id} className={clsx('grid gap-2 items-center', managerUnlocked ? 'grid-cols-[1fr_90px_90px_70px_80px]' : 'grid-cols-[1fr_110px]')}>
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-[var(--app-primary)] flex items-center justify-center shrink-0">
                                                {entry.type === 'BANK' ? <CreditCard size={11} /> : <Smartphone size={11} />}
                                            </span>
                                            <span className="text-xs font-bold text-[var(--app-text)] truncate">{entry.name}</span>
                                        </div>
                                        {/* Software: hidden from non-managers */}
                                        {managerUnlocked && <input type="number" value={entry.software} onChange={e => { const c = [...reconEntries]; c[idx] = { ...c[idx], software: e.target.value }; setReconEntries(c); }} className="w-full px-2 py-1.5 bg-[var(--app-surface-hover)] border border-[var(--app-border)] rounded-lg text-[var(--app-text)] text-xs font-bold text-center outline-none focus:border-[var(--app-primary-strong)]" />}
                                        {/* Real balance — always visible */}
                                        <input type="number" value={entry.real} onChange={e => { const c = [...reconEntries]; c[idx] = { ...c[idx], real: e.target.value }; setReconEntries(c); }} className="w-full px-2 py-1.5 bg-[var(--app-info-bg)] border border-violet-500/20 rounded-lg text-[var(--app-info)] text-xs font-bold text-center outline-none focus:border-violet-400" />
                                        {/* Calibration delta — hidden from cashier */}
                                        {managerUnlocked && <span className={clsx('text-xs font-black text-center', cal > 0 ? 'text-[var(--app-success)]' : cal < 0 ? 'text-[var(--app-error)]' : 'text-[var(--app-text-faint)]')}>{cal !== 0 ? (cal > 0 ? '+' : '') + cal.toFixed(0) : '—'}</span>}
                                        {/* Calibrate button — only when diff exists and manager is unlocked */}
                                        {managerUnlocked && (diff !== 0 ? (
                                            <button
                                                onClick={() => { const c = [...reconEntries]; c[idx] = { ...c[idx], software: entry.real }; setReconEntries(c); }}
                                                className="flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-[var(--app-warning)]/15 border border-amber-400/25 text-[var(--app-warning)] text-[10px] font-bold hover:bg-[var(--app-warning)]/25 transition-all">
                                                ⇄ Calibrate
                                            </button>
                                        ) : <span className="text-[10px] text-[var(--app-success)]/50 text-center font-bold">✓ OK</span>)}
                                    </div>
                                );
                            })}

                            {managerUnlocked ? (
                                <div className="bg-[var(--app-surface-2)] rounded-xl p-4 space-y-1.5 border border-[var(--app-border)]/50">
                                    <p className="text-[10px] text-[var(--app-text-faint)] uppercase tracking-widest font-bold mb-2">Calibration Summary</p>
                                    {[['Cash (software)', `${currency}${cashSW.toFixed(0)}`, ''], ['Calibration', `${totalCalibration > 0 ? '+' : ''}${(-totalCalibration).toFixed(0)}`, totalCalibration > 0 ? 'text-[var(--app-error)]' : totalCalibration < 0 ? 'text-[var(--app-success)]' : 'text-[var(--app-text-faint)]'], ['Cash expected', `${currency}${cashExpected.toFixed(0)}`, 'text-[var(--app-text)] font-black'], ['Counted (real)', `${currency}${cashRL.toFixed(0)}`, ''], ['FINAL GAP', `${finalGap > 0 ? '+' : ''}${currency}${finalGap.toFixed(0)}${finalGap > 0 ? ' EXCESS' : finalGap < 0 ? ' SHORT' : ''}`, finalGap > 0 ? 'text-[var(--app-success)] font-black text-sm' : finalGap < 0 ? 'text-[var(--app-error)] font-black text-sm' : 'text-[var(--app-text-faint)]']].map(([l, v, c]) => (
                                        <div key={l} className="flex justify-between text-xs"><span className="text-[var(--app-text-muted)]">{l}</span><span className={c || 'text-[var(--app-text)] font-bold'}>{v}</span></div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-[var(--app-surface-2)] rounded-xl p-4 text-center border border-[var(--app-border)]/50">
                                    <div className={clsx('text-xl font-black flex items-center justify-center gap-2', finalGap === 0 ? 'text-[var(--app-success)]' : 'text-[var(--app-warning)]')}>
                                        {finalGap === 0 ? <><CheckCircle2 size={24} /> Balanced</> : <><AlertCircle size={24} /> Discrepancy</>}
                                    </div>
                                    {finalGap !== 0 && <p className="text-xs text-[var(--app-text-faint)] mt-2">Manager has been notified</p>}
                                </div>
                            )}

                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--app-surface-hover)] border border-[var(--app-border)] rounded-xl text-[var(--app-text)] text-sm outline-none focus:border-violet-400 resize-none h-14" placeholder="Reconciliation notes..." />
                            <button onClick={handleOpen} disabled={loading} className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-600 text-[var(--app-text)] font-black text-lg shadow-2xl shadow-violet-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                                {loading ? <Loader2 size={22} className="animate-spin" /> : <><ArrowRightLeft size={22} /> Open with Reconciliation</>}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
});

// ─── Brand Panel (Dynamic) ───────────────────────────────────────
function BrandPanel() {
    const [orgName, setOrgName] = useState('');
    const [orgLogo, setOrgLogo] = useState('');
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const tick = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(tick);
    }, []);

    useEffect(() => {
        erpFetch('auth/me/')
            .then(async res => {
                if (res.ok) {
                    const data = await res.json();
                    setOrgName(data.organization?.name || data.org_name || data.name || '');
                    setOrgLogo(data.organization?.logo || data.logo || '');
                }
            })
            .catch(() => { });
    }, []);

    const hh = time.getHours().toString().padStart(2, '0');
    const mm = time.getMinutes().toString().padStart(2, '0');
    const ss = time.getSeconds().toString().padStart(2, '0');
    const dateStr = time.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="flex flex-col items-center justify-center h-full p-10 relative">
            {/* Glow rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 rounded-full border border-[var(--app-primary-strong)]/10 animate-pulse" />
                <div className="absolute w-48 h-48 rounded-full border border-[var(--app-primary-strong)]/10" />
            </div>

            <div className="relative z-10 text-center">
                {/* Logo / icon */}
                {orgLogo ? (
                    <img src={orgLogo} alt={orgName} className="w-20 h-20 rounded-2xl object-contain mx-auto mb-6 shadow-2xl shadow-[var(--app-primary-glow)]" />
                ) : (
                    <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-[var(--app-primary-glow)]"
                        style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.25) 0%, rgba(99,102,241,0.25) 100%)', border: '1px solid rgba(0,212,255,0.3)' }}>
                        <Zap size={36} className="text-[var(--app-primary)]" />
                    </div>
                )}

                {/* Org name */}
                {orgName && (
                    <h1 className="text-2xl font-black text-[var(--app-text)] mb-1 tracking-tight">{orgName}</h1>
                )}
                <p className="text-xs font-bold uppercase tracking-[0.3em]" className="text-[var(--app-primary)]/60">POS Terminal</p>

                {/* Live Clock */}
                <div className="mt-10">
                    <div className="font-black text-5xl tracking-tight text-[var(--app-text)] tabular-nums" >
                        {hh}<span className="text-[var(--app-primary)] animate-pulse">:</span>{mm}<span className="text-[var(--app-text-muted)] text-3xl">.{ss}</span>
                    </div>
                    <p className="text-[var(--app-text-muted)] text-sm font-medium mt-2">{dateStr}</p>
                </div>

                {/* Bottom badge */}
                <div className="mt-12 flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--app-success)] animate-pulse shadow-sm shadow-sm shadow-[var(--app-success)]" />
                    <span className="text-[11px] font-bold text-[var(--app-text-faint)] uppercase tracking-widest">System Online</span>
                </div>
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════
// MAIN LOBBY — State Machine
// ═════════════════════════════════════════════════════════════════
export default function POSLobby({ currency, onEnterPOS }: POSLobbyProps) {
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<LobbyStep>('site');
    const [selectedSite, setSelectedSite] = useState<Site | null>(null);
    const [selectedRegister, setSelectedRegister] = useState<Register | null>(null);
    const [selectedCashier, setSelectedCashier] = useState<RegisterUser | null>(null);
    const [verifiedUser, setVerifiedUser] = useState<{ id: number; name: string; username: string } | null>(null);

    const loadLobby = useCallback(async () => {
        setLoading(true);
        try {
            const { getPosLobby } = await import('@/components/pos/register-actions');
            const result = await getPosLobby();
            if (result.success && result.data) {
                setSites(result.data);
                if (result.data.length === 1) { setSelectedSite(result.data[0]); setStep('register'); }
            } else { toast.error(result.error || 'Failed to load lobby'); }
        } catch { toast.error('Failed to connect'); }
        setLoading(false);
    }, []);

    useEffect(() => { loadLobby(); }, [loadLobby]);

    const goBack = useCallback(() => {
        if (step === 'opening') { setStep('pin'); setVerifiedUser(null); }
        else if (step === 'pin') { setStep('user'); setSelectedCashier(null); }
        else if (step === 'user') { setStep('register'); setSelectedRegister(null); }
        else if (step === 'register') { setStep('site'); setSelectedSite(null); }
    }, [step]);

    const handlePinVerified = useCallback((user: { id: number; name: string; username: string }) => {
        setVerifiedUser(user);
        if (selectedRegister?.isOpen && selectedRegister.currentSession?.cashierId === user.id) {
            onEnterPOS({ registerId: selectedRegister.id, registerName: selectedRegister.name, sessionId: selectedRegister.currentSession!.id, cashierId: user.id, cashierName: user.name, warehouseId: selectedRegister.warehouseId, cashAccountId: selectedRegister.cashAccountId, allowedAccounts: selectedRegister.allowedAccounts || [], siteName: selectedSite?.name || '', paymentMethods: selectedRegister.paymentMethods || [] });
        } else { setStep('opening'); }
    }, [selectedRegister, selectedSite, onEnterPOS]);

    /* ── Loading screen ── */
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" className="bg-app-bg">
            <div className="text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" className="bg-[var(--app-primary-light)] border border-[var(--app-primary-strong)]/30">
                    <Loader2 size={28} className="animate-spin" className="text-[var(--app-primary)]" />
                </div>
                <p className="text-sm font-black uppercase tracking-[0.3em]" className="text-[var(--app-primary)]/50">Loading Registers...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex overflow-hidden" className="bg-app-bg">
            {/* Dot grid overlay */}
            <div className="fixed inset-0 pointer-events-none" className="opacity-10 pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

            {/* ── LEFT: Brand Panel ── */}
            <div className="hidden lg:flex w-[35%] shrink-0 flex-col relative border-r" className="border-r border-[var(--app-primary-strong)]/10 bg-[var(--app-surface-2)]">
                <BrandPanel />
                {/* Settings link at bottom */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                    <a href="/sales/pos-settings" className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all" className="text-[var(--app-text-muted)] bg-[var(--app-surface-hover)] border border-[var(--app-border)]"
                        onMouseEnter={e => {   }}
                        onMouseLeave={e => {   }}>
                        <Settings2 size={13} /> POS Settings
                    </a>
                </div>
            </div>

            {/* ── RIGHT: Step Wizard ── */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Step header */}
                <header className="px-6 pt-8 pb-0 flex items-center justify-between">
                    <button
                        onClick={goBack}
                        className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all', step !== 'site' ? 'text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]' : 'invisible')}
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                    <div className="lg:hidden flex items-center gap-2 text-xs font-bold" className="text-[var(--app-primary)]/70">
                        <Zap size={14} /> POS Terminal
                    </div>
                    <div className="w-20" /> {/* spacer */}
                </header>

                {/* Step progress */}
                <div className="px-6 pt-6">
                    <StepProgress current={step} />
                </div>

                {/* Step content */}
                <main className="flex-1 flex items-start justify-center px-6 pb-10 overflow-y-auto">
                    {step === 'site' && <SiteStep sites={sites} onSelect={s => { setSelectedSite(s); setStep('register'); }} />}
                    {step === 'register' && selectedSite && <RegisterStep site={selectedSite} onSelect={r => { setSelectedRegister(r); setStep('user'); }} />}
                    {step === 'user' && selectedRegister && <UserStep register={selectedRegister} onSelect={u => { setSelectedCashier(u); setStep('pin'); }} />}
                    {step === 'pin' && selectedRegister && selectedCashier && <PinStep register={selectedRegister} cashier={selectedCashier} onVerified={handlePinVerified} />}
                    {step === 'opening' && selectedRegister && selectedSite && verifiedUser && (
                        <OpeningStep register={selectedRegister} site={selectedSite} verifiedUser={verifiedUser} currency={currency} onEnterPOS={onEnterPOS} />
                    )}
                </main>

                {/* Footer */}
                <footer className="px-6 py-3 flex items-center justify-between border-t" className="border-[var(--app-border)]">
                    <p className="text-[10px] font-mono" className="text-[var(--app-text-faint)]">POS v3.1</p>
                    <a href="/sales/pos-settings"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                        className="text-[var(--app-text-muted)] bg-[var(--app-surface-hover)] border border-[var(--app-border)]"
                        
                        >
                        <Settings2 size={10} /> POS Settings
                    </a>
                    <p className="text-[10px]" className="text-[var(--app-text-faint)]">{new Date().toLocaleDateString()}</p>
                </footer>
            </div>
        </div>
    );
}
