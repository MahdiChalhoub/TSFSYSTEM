'use client';

/**
 * POSLobby — Redesigned Multi-Step Register Entry
 * =================================================
 * Flow: Site → Register → Who's Working? → PIN → Open
 *
 * Each step is a separate memoized component for fast renders.
 * The lobby manages the wizard state machine, steps handle visuals.
 */

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Building2, Monitor, Lock, Unlock, User, ChevronRight, Clock, DollarSign, ArrowLeft, Shield, Loader2, Banknote, CreditCard, Smartphone, AlertCircle, CheckCircle2, Zap, BarChart3, ArrowRightLeft, Settings2 } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────

interface RegisterUser {
 id: number;
 name: string;
 username: string;
 hasPin: boolean;
}

interface RegisterAccount {
 id: number;
 name: string;
 type: string;
}

interface RegisterSession {
 id: number;
 cashierId: number;
 cashierName: string;
 openedAt: string;
 openingBalance: number;
}

interface Register {
 id: number;
 name: string;
 isOpen: boolean;
 currentSession: RegisterSession | null;
 cashAccountId: number | null;
 cashAccountName: string | null;
 warehouseId: number | null;
 warehouseName: string | null;
 allowedAccounts: RegisterAccount[];
 authorizedUsers: RegisterUser[];
 openingMode?: string;
 cashierCanSeeSoftware?: boolean;
 paymentMethods?: Array<{ key: string; label: string; accountId: number | null }>;
}

interface Site {
 id: number;
 name: string;
 code: string;
 address: string;
 registers: Register[];
}

interface POSLobbyProps {
 currency: string;
 onEnterPOS: (config: {
 registerId: number;
 registerName: string;
 sessionId: number;
 cashierId: number;
 cashierName: string;
 warehouseId: number | null;
 cashAccountId: number | null;
 allowedAccounts: RegisterAccount[];
 siteName: string;
 paymentMethods: Array<{ key: string; label: string; accountId: number | null }>;
 }) => void;
}

type LobbyStep = 'site' | 'register' | 'user' | 'pin' | 'opening';

// ═════════════════════════════════════════════════════════════════
// STEP COMPONENTS (Memoized)
// ═════════════════════════════════════════════════════════════════

// ─── Step 1: Site Selection ──────────────────────────────────────
const SiteStep = memo(function SiteStep({
 sites,
 onSelect,
}: {
 sites: Site[];
 onSelect: (site: Site) => void;
}) {
 const [tab, setTab] = useState<'with' | 'without'>('with');
 const sitesWithRegs = sites.filter(s => s.registers.length > 0);
 const sitesWithout = sites.filter(s => s.registers.length === 0);
 const displayed = tab === 'with' ? sitesWithRegs : sitesWithout;

 return (
 <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="text-center mb-6">
 <Building2 size={40} className="text-indigo-400 mx-auto mb-3" />
 <h2 className="text-2xl font-black text-app-text mb-1">Select Your Site</h2>
 <p className="text-app-text/40 text-sm">Choose the location where you&apos;re working today</p>
 </div>

 {/* Tabs */}
 <div className="flex items-center justify-center gap-2 mb-6">
 {(['with', 'without'] as const).map(t => {
 const count = t === 'with' ? sitesWithRegs.length : sitesWithout.length;
 const isActive = tab === t;
 const color = t === 'with' ? 'indigo' : 'amber';
 return (
 <button
 key={t}
 onClick={() => setTab(t)}
 className={clsx(
 "px-5 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2",
 isActive
 ? `bg-${color}-500 text-app-text shadow-lg shadow-${color}-500/30`
 : "bg-app-text/5 text-app-text/50 hover:bg-app-text/10 hover:text-app-text/80"
 )}
 >
 {t === 'with' ? <Monitor size={14} /> : <Building2 size={14} />}
 {t === 'with' ? 'With Registers' : 'Without Registers'}
 <span className={clsx("w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center", isActive ? "bg-app-text/25" : "bg-app-text/10")}>{count}</span>
 </button>
 );
 })}
 </div>

 {/* Site Cards */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {displayed.map(site => (
 <button
 key={site.id}
 onClick={() => {
 if (site.registers.length > 0) onSelect(site);
 else toast.info(`"${site.name}" has no registers. Create one in POS Settings.`);
 }}
 className={clsx(
 "group relative p-6 rounded-2xl border transition-all text-left active:scale-[0.98]",
 site.registers.length > 0
 ? "bg-app-text/5 border-app-text/10 hover:border-indigo-500/50 hover:bg-indigo-500/10"
 : "bg-white/[0.02] border-app-text/5 hover:border-amber-500/30 hover:bg-amber-500/5 opacity-70"
 )}
 >
 <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/10 group-hover:to-purple-500/10 transition-all" />
 <div className="relative">
 <div className={clsx(
 "w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all",
 site.registers.length > 0
 ? "bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-app-text"
 : "bg-amber-500/10 text-amber-400/60"
 )}>
 <Building2 size={24} />
 </div>
 <h3 className="font-black text-app-text text-lg">{site.name}</h3>
 {site.code && <p className="text-app-text/30 text-xs font-mono">{site.code}</p>}
 {site.address && <p className="text-app-text/20 text-xs mt-1 line-clamp-1">{site.address}</p>}
 <div className="mt-3 flex items-center gap-2">
 {site.registers.length > 0 ? (
 <>
 <span className="px-2 py-0.5 rounded-full bg-app-text/5 text-app-text/50 text-[10px] font-bold">
 {site.registers.length} register{site.registers.length !== 1 ? 's' : ''}
 </span>
 {site.registers.some(r => r.isOpen) && (
 <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold animate-pulse">
 ● Active
 </span>
 )}
 </>
 ) : (
 <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/60 text-[10px] font-bold">
 No registers — Setup needed
 </span>
 )}
 </div>
 </div>
 </button>
 ))}
 </div>

 {displayed.length === 0 && (
 <div className="text-center py-16">
 <AlertCircle size={48} className="text-app-text/10 mx-auto mb-4" />
 <p className="text-app-text/30 font-bold">{tab === 'with' ? 'No sites with registers' : 'All sites have registers'}</p>
 <p className="text-app-text/15 text-sm mt-1">{tab === 'with' ? 'Create registers in POS Settings' : 'Nothing to configure here'}</p>
 </div>
 )}
 </div>
 );
});

// ─── Step 2: Register Selection ──────────────────────────────────
const RegisterStep = memo(function RegisterStep({
 site,
 onSelect,
}: {
 site: Site;
 onSelect: (register: Register) => void;
}) {
 return (
 <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="text-center mb-8">
 <Monitor size={40} className="text-indigo-400 mx-auto mb-3" />
 <h2 className="text-2xl font-black text-app-text mb-1">Select Register</h2>
 <p className="text-app-text/40 text-sm">{site.name} — Choose your workstation</p>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {site.registers.map(reg => (
 <button
 key={reg.id}
 onClick={() => onSelect(reg)}
 className={clsx(
 "group relative p-6 rounded-2xl border transition-all text-left active:scale-[0.98]",
 reg.isOpen
 ? "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-400"
 : "bg-app-text/5 border-app-text/10 hover:border-indigo-500/50 hover:bg-indigo-500/10"
 )}
 >
 <div className="relative">
 <div className="flex items-center justify-between mb-3">
 <div className={clsx(
 "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
 reg.isOpen
 ? "bg-emerald-500/20 text-emerald-400"
 : "bg-app-text/10 text-app-text/50 group-hover:bg-indigo-500 group-hover:text-app-text"
 )}>
 <Monitor size={24} />
 </div>
 {reg.isOpen ? (
 <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">
 <Unlock size={10} /> Open
 </span>
 ) : (
 <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-app-text/5 text-app-text/30 text-[10px] font-black uppercase">
 <Lock size={10} /> Closed
 </span>
 )}
 </div>
 <h3 className="font-black text-app-text text-lg">{reg.name}</h3>
 {reg.isOpen && reg.currentSession && (
 <div className="mt-2 space-y-1">
 <p className="text-emerald-400/80 text-xs font-bold flex items-center gap-1">
 <User size={10} /> {reg.currentSession.cashierName}
 </p>
 <p className="text-app-text/20 text-[10px] flex items-center gap-1">
 <Clock size={10} /> Since {new Date(reg.currentSession.openedAt).toLocaleTimeString()}
 </p>
 </div>
 )}
 <div className="mt-3 flex flex-wrap gap-1">
 {reg.allowedAccounts.slice(0, 4).map(acc => (
 <span key={acc.id} className="px-1.5 py-0.5 rounded bg-app-text/5 text-app-text/30 text-[9px] font-bold">{acc.name}</span>
 ))}
 {reg.allowedAccounts.length > 4 && (
 <span className="px-1.5 py-0.5 rounded bg-app-text/5 text-app-text/20 text-[9px]">+{reg.allowedAccounts.length - 4}</span>
 )}
 </div>
 </div>
 </button>
 ))}
 </div>
 {site.registers.length === 0 && (
 <div className="text-center py-16">
 <Monitor size={48} className="text-app-text/10 mx-auto mb-4" />
 <p className="text-app-text/30 font-bold">No registers at this site</p>
 <p className="text-app-text/15 text-sm mt-1">Create registers in Settings → POS</p>
 </div>
 )}
 </div>
 );
});

// ─── Step 3: User Selection ──────────────────────────────────────
const UserStep = memo(function UserStep({
 register,
 onSelect,
}: {
 register: Register;
 onSelect: (user: RegisterUser) => void;
}) {
 return (
 <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="text-center mb-8">
 <div className="w-20 h-20 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 ring-4 ring-indigo-500/10">
 <User size={36} />
 </div>
 <h2 className="text-2xl font-black text-app-text mb-1">Who&apos;s working?</h2>
 <p className="text-app-text/40 text-sm">{register.name} — tap your name to continue</p>
 </div>
 {register.authorizedUsers.length > 0 ? (
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 {register.authorizedUsers.map(u => (
 <button
 key={u.id}
 onClick={() => onSelect(u)}
 className="group relative p-5 rounded-2xl border transition-all text-center active:scale-[0.97] bg-app-text/5 border-app-text/10 hover:border-indigo-400 hover:bg-indigo-500/10"
 >
 <div className="w-14 h-14 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3 font-black text-xl group-hover:bg-indigo-500 group-hover:text-app-text transition-all">
 {u.name?.substring(0, 2).toUpperCase()}
 </div>
 <p className="text-sm font-black text-app-text">{u.name}</p>
 {!u.hasPin && (
 <p className="text-[10px] text-amber-400 mt-1 flex items-center justify-center gap-1">
 <AlertCircle size={10} /> No PIN set
 </p>
 )}
 </button>
 ))}
 </div>
 ) : (
 <div className="text-center py-12">
 <AlertCircle size={40} className="text-app-text/20 mx-auto mb-3" />
 <p className="text-app-text/30 font-bold">No cashiers assigned to this register</p>
 <p className="text-app-text/15 text-sm mt-1">Assign users in POS Configuration → Registers</p>
 </div>
 )}
 </div>
 );
});

// ─── Step 4: PIN Entry ───────────────────────────────────────────
const PinStep = memo(function PinStep({
 register,
 cashier,
 onVerified,
}: {
 register: Register;
 cashier: RegisterUser;
 onVerified: (user: { id: number; name: string; username: string }) => void;
}) {
 const [pin, setPin] = useState('');
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);
 const inputRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 setTimeout(() => inputRef.current?.focus(), 200);
 }, []);

 const handleSubmit = async () => {
 if (pin.length < 4) return;
 setLoading(true);
 setError('');
 try {
 const { verifyPosPin } = await import('@/components/pos/register-actions');
 const result = await verifyPosPin(register.id, pin, cashier.id);
 if (result.success && result.data?.valid) {
 toast.success(`Welcome, ${result.data.user.name}!`);
 onVerified(result.data.user);
 } else {
 setError('Invalid PIN. Try again.');
 setPin('');
 }
 } catch {
 setError('Security Engine Fault');
 }
 setLoading(false);
 };

 return (
 <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-500">
 <div className="text-center mb-8">
 <div className="w-20 h-20 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 ring-4 ring-indigo-500/10">
 <Shield size={36} />
 </div>
 <h2 className="text-2xl font-black text-app-text mb-1">Enter your PIN</h2>
 <p className="text-app-text/40 text-sm">{register.name} — {cashier.name}</p>
 </div>

 <div className="bg-app-text/5 rounded-3xl p-6 border border-app-text/10 backdrop-blur-sm">
 {/* PIN dots */}
 <div className="flex justify-center gap-3 mb-6">
 {[0, 1, 2, 3, 4, 5].map(i => (
 <div
 key={i}
 className={clsx(
 "w-10 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-200",
 i < pin.length ? "border-indigo-500 bg-indigo-500/20" : "border-app-text/10 bg-app-text/5"
 )}
 >
 {i < pin.length && <div className="w-3 h-3 rounded-full bg-indigo-400 animate-in zoom-in duration-200" />}
 </div>
 ))}
 </div>

 <input
 ref={inputRef}
 type="password"
 inputMode="numeric"
 pattern="[0-9]*"
 maxLength={6}
 value={pin}
 onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
 onKeyDown={(e) => { if (e.key === 'Enter' && pin.length >= 4) handleSubmit(); }}
 className="sr-only"
 autoFocus
 />

 {error && (
 <div className="flex items-center justify-center gap-2 text-rose-400 text-xs font-bold mb-4 animate-in shake-x">
 <AlertCircle size={14} /> {error}
 </div>
 )}

 {/* Numpad */}
 <div className="grid grid-cols-3 gap-2">
 {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'].map(key => (
 <button
 key={key}
 onClick={() => {
 if (key === 'C') { setPin(''); setError(''); }
 else if (key === '✓') { if (pin.length >= 4) handleSubmit(); }
 else if (pin.length < 6) setPin(p => p + key);
 }}
 disabled={loading}
 className={clsx(
 "h-14 rounded-xl font-black text-xl transition-all active:scale-95",
 key === '✓'
 ? pin.length >= 4
 ? "bg-emerald-500 text-app-text hover:bg-emerald-400 shadow-lg shadow-emerald-500/30"
 : "bg-app-text/5 text-app-text/20 cursor-not-allowed"
 : key === 'C'
 ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
 : "bg-app-text/10 text-app-text hover:bg-app-text/20"
 )}
 >
 {loading && key === '✓' ? <Loader2 size={20} className="animate-spin mx-auto" /> : key}
 </button>
 ))}
 </div>

 {/* Authorized users hint */}
 <div className="mt-4 pt-4 border-t border-app-text/5">
 <p className="text-[10px] text-app-text/20 uppercase tracking-widest font-bold mb-2 text-center">Authorized Cashiers</p>
 <div className="flex flex-wrap justify-center gap-1.5">
 {register.authorizedUsers.map(u => (
 <span key={u.id} className="px-2 py-0.5 rounded-full bg-app-text/5 text-app-text/30 text-[10px] font-bold flex items-center gap-1">
 <User size={8} /> {u.name}
 {!u.hasPin && <span className="text-amber-400/50" title="No PIN set">⚠</span>}
 </span>
 ))}
 </div>
 </div>
 </div>
 </div>
 );
});

// ─── Step 5: Opening ─────────────────────────────────────────────
const OpeningStep = memo(function OpeningStep({
 register,
 site,
 verifiedUser,
 currency,
 onEnterPOS,
}: {
 register: Register;
 site: Site;
 verifiedUser: { id: number; name: string; username: string };
 currency: string;
 onEnterPOS: POSLobbyProps['onEnterPOS'];
}) {
 const [openingBalance, setOpeningBalance] = useState('0');
 const [notes, setNotes] = useState('');
 const [loading, setLoading] = useState(false);
 const [openingMode, setOpeningMode] = useState<'standard' | 'advanced'>(
 register.openingMode === 'advanced' ? 'advanced' : 'standard'
 );
 const [managerUnlocked, setManagerUnlocked] = useState(register.cashierCanSeeSoftware === true);
 const [showManagerPin, setShowManagerPin] = useState(false);
 const [managerPinInput, setManagerPinInput] = useState('');
 const [reconEntries, setReconEntries] = useState<Array<{
 account_id: number; name: string; type: string; software: string; real: string;
 }>>([]);
 const [cashSoftware, setCashSoftware] = useState('0');
 const [cashReal, setCashReal] = useState('0');
 const [accountBookBalance, setAccountBookBalance] = useState('0');
 const [sessionConflict, setSessionConflict] = useState<{ cashierName: string; sessionId: number } | null>(null);
 const [forceClosePin, setForceClosePin] = useState('');
 const [forceCloseLoading, setForceCloseLoading] = useState(false);

 useEffect(() => {
 if (openingMode === 'advanced') {
 setReconEntries(
 register.allowedAccounts
 .filter(acc => acc.type !== 'CASH')
 .map(acc => ({ account_id: acc.id, name: acc.name, type: acc.type, software: '0', real: '0' }))
 );
 }
 }, [openingMode, register.allowedAccounts]);

 const handleOpen = async () => {
 setLoading(true);
 try {
 const { openRegisterSession } = await import('@/components/pos/register-actions');
 let advancedData: any = undefined;
 if (openingMode === 'advanced' && reconEntries.length > 0) {
 advancedData = {
 opening_mode: 'advanced' as const,
 account_reconciliations: reconEntries.map(e => ({
 account_id: e.account_id,
 software_amount: parseFloat(e.software) || 0,
 statement_amount: parseFloat(e.real) || 0,
 })),
 cash_counted: parseFloat(cashReal) || 0,
 cash_software: parseFloat(cashSoftware) || 0,
 account_book_balance: parseFloat(accountBookBalance) || 0,
 };
 }

 const result = await openRegisterSession(
 register.id, verifiedUser.id, parseFloat(openingBalance) || 0, notes, advancedData
 );

 if (result.success && result.data) {
 setSessionConflict(null);
 toast.success(result.data.message || 'Session initialized');
 onEnterPOS({
 registerId: register.id,
 registerName: register.name,
 sessionId: result.data.session_id,
 cashierId: verifiedUser.id,
 cashierName: verifiedUser.name,
 warehouseId: result.data.warehouse_id || register.warehouseId,
 cashAccountId: result.data.cash_account_id || register.cashAccountId,
 allowedAccounts: result.data.allowed_accounts || register.allowedAccounts || [],
 siteName: site.name,
 paymentMethods: result.data.payment_methods || register.paymentMethods || [],
 });
 } else {
 const errCode = result.data?.error_code;
 if (errCode === 'SESSION_OPEN') {
 setSessionConflict({
 cashierName: result.data?.current_cashier || 'another cashier',
 sessionId: result.data?.current_session_id,
 });
 } else if (errCode === 'NO_FISCAL_YEAR') {
 toast.error('No open fiscal year — check Finance settings', { duration: 6000 });
 } else if (errCode === 'NO_PAYMENT_ACCOUNTS') {
 toast.error('No payment accounts linked for this register', { duration: 6000 });
 } else {
 toast.error(result.error || 'Opening Logic Fault');
 }
 }
 } catch (e: any) {
 toast.error('Connection fault: ' + (e.message || 'Unknown'));
 }
 setLoading(false);
 };

 const handleForceClose = async () => {
 if (forceClosePin.length < 4) { toast.error('Enter manager PIN'); return; }
 setForceCloseLoading(true);
 try {
 const { openRegisterSession } = await import('@/components/pos/register-actions');
 let advancedData: any = undefined;
 if (openingMode === 'advanced' && reconEntries.length > 0) {
 advancedData = {
 opening_mode: 'advanced' as const,
 account_reconciliations: reconEntries.map(e => ({ account_id: e.account_id, software_amount: parseFloat(e.software) || 0, statement_amount: parseFloat(e.real) || 0 })),
 cash_counted: parseFloat(cashReal) || 0,
 cash_software: parseFloat(cashSoftware) || 0,
 account_book_balance: parseFloat(accountBookBalance) || 0,
 };
 }
 const result = await openRegisterSession(register.id, verifiedUser.id, parseFloat(openingBalance) || 0, notes, advancedData, true, forceClosePin);
 if (result.success && result.data) {
 setSessionConflict(null);
 setForceClosePin('');
 toast.success(result.data.message);
 onEnterPOS({
 registerId: register.id, registerName: register.name, sessionId: result.data.session_id,
 cashierId: verifiedUser.id, cashierName: verifiedUser.name,
 warehouseId: result.data.warehouse_id, cashAccountId: result.data.cash_account_id,
 allowedAccounts: result.data.allowed_accounts || register.allowedAccounts,
 siteName: site.name, paymentMethods: register.paymentMethods || [],
 });
 } else if (result.data?.error_code === 'INVALID_OVERRIDE_PIN') {
 toast.error('Wrong manager PIN');
 } else {
 toast.error(result.error || 'Force close failed');
 }
 } catch { toast.error('Connection fault'); }
 setForceCloseLoading(false);
 };

 // Calibration math
 const totalCalibration = reconEntries.reduce((sum, e) => {
 return sum + ((parseFloat(e.real) || 0) - (parseFloat(e.software) || 0));
 }, 0);
 const cashSW = parseFloat(cashSoftware) || 0;
 const cashRL = parseFloat(cashReal) || 0;
 const cashExpected = cashSW - totalCalibration;
 const cashGap = cashRL - cashExpected;
 const abBal = parseFloat(accountBookBalance) || 0;
 const finalGap = cashGap - abBal;

 return (
 <div className={clsx("w-full animate-in fade-in slide-in-from-bottom-4 duration-500", openingMode === 'advanced' ? 'max-w-3xl' : 'max-w-md')}>
 {/* Session Conflict */}
 {sessionConflict && (
 <div className="mb-6 bg-amber-500/10 border border-amber-400/30 rounded-2xl p-6 space-y-4">
 <div className="flex items-start gap-3">
 <AlertCircle size={22} className="text-amber-400 shrink-0 mt-0.5" />
 <div>
 <p className="text-amber-300 font-black text-sm">Register In Use</p>
 <p className="text-amber-200/70 text-xs mt-1">
 Opened by <span className="font-bold text-amber-200">{sessionConflict.cashierName}</span>.
 Ask them to close, or use a manager override.
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <input
 type="password" inputMode="numeric" value={forceClosePin}
 onChange={e => setForceClosePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
 placeholder="Manager PIN" maxLength={6}
 className="flex-1 px-4 py-2.5 bg-black/30 border border-amber-300/30 rounded-xl text-sm font-mono font-bold text-amber-100 outline-none focus:ring-2 focus:ring-amber-400/40 tracking-[0.3em] text-center"
 />
 <button
 onClick={handleForceClose}
 disabled={forceCloseLoading || forceClosePin.length < 4}
 className="px-4 py-2.5 bg-amber-500 text-app-text rounded-xl font-bold text-sm hover:bg-amber-600 disabled:opacity-40 transition-all flex items-center gap-2 shrink-0"
 >
 {forceCloseLoading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
 Force Close
 </button>
 </div>
 </div>
 )}

 <div className="text-center mb-6">
 <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 ring-4 ring-emerald-500/10">
 <CheckCircle2 size={32} />
 </div>
 <h2 className="text-2xl font-black text-app-text mb-1">Open Register</h2>
 <p className="text-app-text/40 text-sm">{register.name} — {verifiedUser.name}</p>
 </div>

 {/* If register already open by this user */}
 {register.isOpen && register.currentSession && (
 <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 text-center">
 <p className="text-amber-400 text-sm font-bold">⚠ Register is currently open</p>
 <p className="text-amber-400/60 text-xs mt-1">
 Opened by {register.currentSession.cashierName} — Close it first to start a new session
 </p>
 <button
 onClick={() => onEnterPOS({
 registerId: register.id, registerName: register.name,
 sessionId: register.currentSession!.id,
 cashierId: verifiedUser.id, cashierName: verifiedUser.name,
 warehouseId: register.warehouseId, cashAccountId: register.cashAccountId,
 allowedAccounts: register.allowedAccounts,
 siteName: site.name, paymentMethods: register.paymentMethods || [],
 })}
 className="mt-3 px-6 py-2 rounded-xl bg-amber-500 text-app-text font-bold text-sm hover:bg-amber-400 transition-all active:scale-95"
 >
 Enter Existing Session →
 </button>
 </div>
 )}

 {/* Opening form (only when register is NOT open) */}
 {!register.isOpen && (
 <>
 {/* Advanced mode badge */}
 {openingMode === 'advanced' && (
 <div className="flex items-center justify-center gap-3 mb-5">
 <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30">
 <BarChart3 size={14} className="text-violet-400" />
 <span className="text-xs font-black text-violet-400 uppercase tracking-wider">Advanced Reconciliation</span>
 </div>
 {!managerUnlocked && (
 <button onClick={() => setShowManagerPin(!showManagerPin)}
 className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-app-text/5 border border-app-text/10 hover:border-amber-500/30 text-xs font-bold text-app-text/40 hover:text-amber-400 transition-all"
 >
 <Lock size={12} /> Show Details
 </button>
 )}
 {managerUnlocked && (
 <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400">
 <Unlock size={12} /> Full View
 </span>
 )}
 </div>
 )}

 {/* Manager PIN unlock */}
 {showManagerPin && !managerUnlocked && (
 <div className="flex items-center justify-center gap-2 mb-5 animate-in fade-in duration-200">
 <input
 type="password" inputMode="numeric" value={managerPinInput}
 onChange={(e) => setManagerPinInput(e.target.value.replace(/\D/g, ''))}
 placeholder="Manager PIN" maxLength={6}
 className="w-32 px-3 py-2 bg-app-text/5 border border-app-text/10 rounded-lg text-app-text text-sm font-bold text-center outline-none focus:border-amber-500"
 onKeyDown={(e) => { if (e.key === 'Enter' && managerPinInput.length >= 4) { setManagerUnlocked(true); setShowManagerPin(false); toast.success('Manager access granted'); } }}
 />
 <button onClick={() => { setManagerUnlocked(true); setShowManagerPin(false); toast.success('Manager access granted'); }}
 className="px-3 py-2 rounded-lg bg-amber-500 text-app-text text-xs font-bold hover:bg-amber-400 transition-all"
 >Unlock</button>
 </div>
 )}

 {openingMode === 'standard' ? (
 <div className="bg-app-text/5 rounded-3xl p-6 border border-app-text/10 space-y-4">
 <div>
 <label className="text-[10px] text-app-text/40 uppercase tracking-widest font-bold block mb-1.5">Opening Cash Balance ({currency})</label>
 <div className="relative">
 <Banknote size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text/30" />
 <input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)}
 className="w-full pl-10 pr-4 py-3 bg-app-text/5 border border-app-text/10 rounded-xl text-app-text text-xl font-black outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all" placeholder="0.00" />
 </div>
 </div>
 <div>
 <label className="text-[10px] text-app-text/40 uppercase tracking-widest font-bold block mb-1.5">Notes (optional)</label>
 <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
 className="w-full px-4 py-2 bg-app-text/5 border border-app-text/10 rounded-xl text-app-text text-sm outline-none focus:border-emerald-500 resize-none h-16" placeholder="Shift notes..." />
 </div>
 <button onClick={handleOpen} disabled={loading}
 className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-app-text font-black text-lg shadow-2xl shadow-emerald-500/30 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
 >
 {loading ? <Loader2 size={24} className="animate-spin" /> : <><Unlock size={24} /> Open Register & Start Selling</>}
 </button>
 </div>
 ) : (
 <div className="bg-app-text/5 rounded-3xl p-6 border border-violet-500/20 space-y-4">
 <div className="flex items-center gap-2 mb-2">
 <ArrowRightLeft size={14} className="text-violet-400" />
 <span className="text-[10px] text-violet-400 uppercase tracking-widest font-black">Account Reconciliation</span>
 </div>

 {/* Table header */}
 <div className={clsx("grid gap-2 text-[9px] text-app-text/30 uppercase tracking-wider font-bold px-1",
 managerUnlocked ? "grid-cols-[1fr_100px_100px_80px]" : "grid-cols-[1fr_120px]"
 )}>
 <span>Payment Method</span>
 {managerUnlocked && <span className="text-center">Software</span>}
 <span className="text-center">{managerUnlocked ? 'Real' : 'Balance'}</span>
 {managerUnlocked && <span className="text-center">→ Cash</span>}
 </div>

 {/* Electronic accounts */}
 {reconEntries.map((entry, idx) => {
 const sw = parseFloat(entry.software) || 0;
 const real = parseFloat(entry.real) || 0;
 const calibration = -(sw - real);
 return (
 <div key={entry.account_id} className={clsx("grid gap-2 items-center",
 managerUnlocked ? "grid-cols-[1fr_100px_100px_80px]" : "grid-cols-[1fr_120px]"
 )}>
 <div className="flex items-center gap-2">
 <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
 {entry.type === 'BANK' ? <CreditCard size={12} /> : <Smartphone size={12} />}
 </span>
 <span className="text-xs font-bold text-app-text truncate">{entry.name}</span>
 </div>
 {managerUnlocked && (
 <input type="number" value={entry.software}
 onChange={(e) => { const copy = [...reconEntries]; copy[idx] = { ...copy[idx], software: e.target.value }; setReconEntries(copy); }}
 className="w-full px-2 py-1.5 bg-app-text/5 border border-app-text/10 rounded-lg text-app-text text-xs font-bold text-center outline-none focus:border-indigo-500" />
 )}
 <input type="number" value={entry.real}
 onChange={(e) => { const copy = [...reconEntries]; copy[idx] = { ...copy[idx], real: e.target.value }; setReconEntries(copy); }}
 className="w-full px-2 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg text-violet-300 text-xs font-bold text-center outline-none focus:border-violet-500" />
 {managerUnlocked && (
 <span className={clsx("text-xs font-black text-center", calibration > 0 ? "text-emerald-400" : calibration < 0 ? "text-rose-400" : "text-app-text/20")}>
 {calibration > 0 ? '+' : ''}{calibration.toFixed(0)}
 </span>
 )}
 </div>
 );
 })}

 {/* Cash row */}
 <div className="border-t border-app-text/10 pt-3">
 <div className={clsx("grid gap-2 items-center", managerUnlocked ? "grid-cols-[1fr_100px_100px_80px]" : "grid-cols-[1fr_120px]")}>
 <div className="flex items-center gap-2">
 <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0"><Banknote size={12} /></span>
 <span className="text-xs font-black text-emerald-400">CASH</span>
 </div>
 {managerUnlocked && <input type="number" value={cashSoftware} onChange={(e) => setCashSoftware(e.target.value)} className="w-full px-2 py-1.5 bg-app-text/5 border border-app-text/10 rounded-lg text-app-text text-xs font-bold text-center outline-none focus:border-emerald-500" />}
 <input type="number" value={cashReal} onChange={(e) => setCashReal(e.target.value)} className="w-full px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs font-bold text-center outline-none focus:border-emerald-500" />
 {managerUnlocked && <span className="text-xs font-black text-app-text/20 text-center">—</span>}
 </div>
 </div>

 {/* Address Book */}
 <div className="border-t border-app-text/10 pt-3">
 <div className={clsx("grid gap-2 items-center", managerUnlocked ? "grid-cols-[1fr_100px_100px_80px]" : "grid-cols-[1fr_120px]")}>
 <div className="flex items-center gap-2">
 <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0"><DollarSign size={12} /></span>
 <span className="text-xs font-bold text-amber-400">Address Book</span>
 </div>
 {managerUnlocked && <span className="text-xs text-app-text/20 text-center">—</span>}
 <input type="number" value={accountBookBalance} onChange={(e) => setAccountBookBalance(e.target.value)}
 className="w-full px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-xs font-bold text-center outline-none focus:border-amber-500" />
 {managerUnlocked && <span className="text-xs text-app-text/20 text-center">—</span>}
 </div>
 </div>

 {/* Calibration Summary */}
 {managerUnlocked ? (
 <div className="bg-slate-800/50 rounded-2xl p-4 border border-app-text/5 space-y-2">
 <p className="text-[10px] text-app-text/30 uppercase tracking-widest font-bold mb-2">Calibration Summary</p>
 <div className="flex justify-between text-xs"><span className="text-app-text/50">Cash (software)</span><span className="text-app-text font-bold">{currency}{cashSW.toFixed(0)}</span></div>
 <div className="flex justify-between text-xs"><span className="text-app-text/50">Calibration adjustment</span><span className={clsx("font-bold", totalCalibration > 0 ? "text-rose-400" : totalCalibration < 0 ? "text-emerald-400" : "text-app-text/30")}>{totalCalibration > 0 ? '+' : ''}{(-totalCalibration).toFixed(0)}</span></div>
 <div className="flex justify-between text-xs border-t border-app-text/5 pt-2"><span className="text-app-text/70 font-bold">Cash expected</span><span className="text-app-text font-black">{currency}{cashExpected.toFixed(0)}</span></div>
 <div className="flex justify-between text-xs"><span className="text-app-text/50">Cash counted (real)</span><span className="text-app-text font-bold">{currency}{cashRL.toFixed(0)}</span></div>
 <div className="flex justify-between text-xs border-t border-app-text/5 pt-2">
 <span className="text-app-text/70 font-bold">Cash gap</span>
 <span className={clsx("font-black", cashGap > 0 ? "text-emerald-400" : cashGap < 0 ? "text-rose-400" : "text-app-text/30")}>{cashGap > 0 ? '+' : ''}{currency}{cashGap.toFixed(0)}</span>
 </div>
 {abBal !== 0 && <div className="flex justify-between text-xs"><span className="text-amber-400/70">Address book</span><span className="text-amber-400 font-bold">{abBal > 0 ? '-' : '+'}{currency}{Math.abs(abBal).toFixed(0)}</span></div>}
 <div className="flex justify-between text-sm border-t border-app-text/10 pt-2">
 <span className="text-app-text font-black">FINAL GAP</span>
 <span className={clsx("font-black text-lg", finalGap > 0 ? "text-emerald-400" : finalGap < 0 ? "text-rose-400" : "text-app-text/50")}>
 {finalGap > 0 ? '+' : ''}{currency}{finalGap.toFixed(0)}
 {finalGap > 0 && <span className="text-[9px] ml-1 text-emerald-400/60">EXCESS</span>}
 {finalGap < 0 && <span className="text-[9px] ml-1 text-rose-400/60">SHORTAGE</span>}
 {finalGap === 0 && <span className="text-[9px] ml-1 text-app-text/30">BALANCED</span>}
 </span>
 </div>
 </div>
 ) : (
 <div className="bg-slate-800/50 rounded-2xl p-5 border border-app-text/5 text-center">
 <p className="text-[10px] text-app-text/30 uppercase tracking-widest font-bold mb-3">Reconciliation Status</p>
 <div className={clsx("text-2xl font-black", finalGap === 0 ? "text-emerald-400" : "text-amber-400")}>
 {finalGap === 0 ? (
 <span className="flex items-center justify-center gap-2"><CheckCircle2 size={28} /> Validated</span>
 ) : (
 <span className="flex items-center justify-center gap-2"><AlertCircle size={28} /> Discrepancy Detected</span>
 )}
 </div>
 {finalGap !== 0 && <p className="text-xs text-app-text/30 mt-2">Manager has been notified</p>}
 </div>
 )}

 <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
 className="w-full px-4 py-2 bg-app-text/5 border border-app-text/10 rounded-xl text-app-text text-sm outline-none focus:border-violet-500 resize-none h-14" placeholder="Reconciliation notes..." />
 <button onClick={handleOpen} disabled={loading}
 className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-600 text-app-text font-black text-lg shadow-2xl shadow-violet-500/30 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
 >
 {loading ? <Loader2 size={24} className="animate-spin" /> : <><Unlock size={24} /> Open with Reconciliation</>}
 </button>
 </div>
 )}
 </>
 )}
 </div>
 );
});

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
 if (result.data.length === 1) {
 setSelectedSite(result.data[0]);
 setStep('register');
 }
 } else {
 toast.error(result.error || 'Failed to load lobby');
 }
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
 onEnterPOS({
 registerId: selectedRegister.id, registerName: selectedRegister.name,
 sessionId: selectedRegister.currentSession!.id,
 cashierId: user.id, cashierName: user.name,
 warehouseId: selectedRegister.warehouseId, cashAccountId: selectedRegister.cashAccountId,
 allowedAccounts: selectedRegister.allowedAccounts || [],
 siteName: selectedSite?.name || 'Central Site',
 paymentMethods: selectedRegister.paymentMethods || [],
 });
 } else {
 setStep('opening');
 }
 }, [selectedRegister, selectedSite, onEnterPOS]);

 if (loading) {
 return (
 <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
 <div className="text-center">
 <Loader2 size={48} className="animate-spin mx-auto mb-4" style={{ color: 'var(--app-primary)' }} />
 <p className="text-sm font-medium tracking-widest uppercase" style={{ color: 'var(--app-text-muted)' }}>Loading Registers...</p>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen flex flex-col" style={{ background: 'var(--app-bg)' }}>
 {/* Header */}
 <header
 className="px-8 py-5 flex items-center justify-between backdrop-blur-sm"
 style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface)' }}
 >
 <div className="flex items-center gap-4">
 {step !== 'site' && (
 <button onClick={goBack} className="w-10 h-10 rounded-xl bg-app-text/5 hover:bg-app-text/10 text-app-text flex items-center justify-center transition-all active:scale-95">
 <ArrowLeft size={18} />
 </button>
 )}
 <div>
 <h1 className="text-xl font-black text-app-text tracking-tight">POS Terminal</h1>
 <div className="flex items-center gap-2 text-[10px] text-app-text/40 font-bold uppercase tracking-[0.3em]">
 {(['site', 'register', 'user', 'pin', 'opening'] as const).map((s, i) => (
 <span key={s} className="flex items-center gap-2">
 {i > 0 && <ChevronRight size={10} />}
 <span className={step === s ? (s === 'opening' ? 'text-emerald-400' : 'text-indigo-400') : 'text-app-text/20'}>
 {s === 'user' ? "Who's working?" : s === 'opening' ? 'Open' : s.charAt(0).toUpperCase() + s.slice(1)}
 </span>
 </span>
 ))}
 </div>
 </div>
 </div>
 <div className="flex items-center gap-3">
 {selectedSite && (
 <div className="text-right mr-2">
 <p className="text-app-text/80 font-bold text-sm">{selectedSite.name}</p>
 {selectedRegister && <p className="text-indigo-400 text-xs font-bold">{selectedRegister.name}</p>}
 </div>
 )}
 {step === 'site' && (
 <a href="/sales/pos-settings" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-app-text/5 hover:bg-app-text/10 text-app-text/40 hover:text-app-text text-xs font-bold transition-all border border-app-text/5 hover:border-app-text/20" title="POS Configuration">
 <Settings2 size={14} />
 <span className="hidden sm:inline">Settings</span>
 </a>
 )}
 </div>
 </header>

 {/* Content */}
 <main className="flex-1 flex items-center justify-center p-8">
 {step === 'site' && <SiteStep sites={sites} onSelect={(s) => { setSelectedSite(s); setStep('register'); }} />}
 {step === 'register' && selectedSite && <RegisterStep site={selectedSite} onSelect={(r) => { setSelectedRegister(r); setStep('user'); }} />}
 {step === 'user' && selectedRegister && <UserStep register={selectedRegister} onSelect={(u) => { setSelectedCashier(u); setStep('pin'); }} />}
 {step === 'pin' && selectedRegister && selectedCashier && <PinStep register={selectedRegister} cashier={selectedCashier} onVerified={handlePinVerified} />}
 {step === 'opening' && selectedRegister && selectedSite && verifiedUser && (
 <OpeningStep register={selectedRegister} site={selectedSite} verifiedUser={verifiedUser} currency={currency} onEnterPOS={onEnterPOS} />
 )}
 </main>

 {/* Footer */}
 <footer className="px-8 py-3 border-t border-app-text/5 bg-black/20 flex items-center justify-between">
 <p className="text-[10px] text-app-text/15 font-mono">POS Terminal v3.0</p>
 <p className="text-[10px] text-app-text/15">{new Date().toLocaleString()}</p>
 </footer>
 </div>
 );
}
