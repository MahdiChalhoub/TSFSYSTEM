'use client';

import { useState, useEffect, memo } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Shield, Loader2, Banknote, CreditCard, Smartphone, AlertCircle, CheckCircle2, BarChart3, ArrowRightLeft, Lock, Unlock, DollarSign } from 'lucide-react';
import type { Site, Register, RegisterUser, POSLobbyProps } from '../types';

export const OpeningStep = memo(function OpeningStep({ register, site, verifiedUser, currency, onEnterPOS }: {
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

    useEffect(() => {
        const init = async () => {
            const { getAccountBookBalance, getRegisterAccountBalances } = await import('@/components/pos/register-actions');

            const abResult = await getAccountBookBalance(register.id).catch(() => null);
            if (abResult?.success && typeof abResult.balance === 'number') {
                setAccountBookLive(abResult.balance);
                setAccountBookBalance(String(abResult.balance));
            }

            if (openingMode === 'advanced') {
                const balResult = await getRegisterAccountBalances(register.id).catch(() => null);
                const balMap: Record<number, number> = {};
                if (balResult?.success && balResult.data) {
                    balResult.data.forEach((acc: any) => { balMap[acc.accountId] = acc.softwareBalance; });
                }

                const entries = register.allowedAccounts
                    .filter(a => a.type !== 'CASH')
                    .map(a => ({
                        account_id: a.id, name: a.name, type: a.type,
                        software: String(balMap[a.id] ?? 0),
                        real: '0',
                    }));
                setReconEntries(entries);

                const cashAcc = balResult?.data?.find((a: any) => a.isCashAccount);
                if (cashAcc) setCashSoftware(String(cashAcc.softwareBalance));
            }
        };
        init();
    }, [register.id, openingMode, register.allowedAccounts]);

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
                                <div className="w-full px-2 py-1.5 bg-[var(--app-warning-bg)] border border-[var(--app-warning)]/20 rounded-lg text-[var(--app-warning)] text-xs font-bold text-center select-all">
                                    {parseFloat(accountBookBalance) !== 0
                                        ? parseFloat(accountBookBalance).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                                        : '0'}
                                </div>
                                {managerUnlocked && <span className="text-[var(--app-text-faint)] text-xs text-center">—</span>}
                                {managerUnlocked && <span />}
                            </div>

                            {reconEntries.length > 0 && (
                                <div className="flex items-center gap-2 pt-1">
                                    <div className="flex-1 h-px bg-[var(--app-surface-hover)]" />
                                    <span className="text-[9px] text-[var(--app-text-faint)] uppercase tracking-widest font-bold">Payment Accounts</span>
                                    <div className="flex-1 h-px bg-[var(--app-surface-hover)]" />
                                </div>
                            )}

                            {reconEntries.map((entry, idx) => {
                                const sw = parseFloat(entry.software) || 0;
                                const rl = parseFloat(entry.real) || 0;
                                const cal = -(sw - rl);
                                const diff = rl - sw;
                                return (
                                    <div key={entry.account_id} className={clsx('grid gap-2 items-center', managerUnlocked ? 'grid-cols-[1fr_90px_90px_70px_80px]' : 'grid-cols-[1fr_110px]')}>
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-lg bg-[var(--app-primary-light)] text-[var(--app-primary)] flex items-center justify-center shrink-0">
                                                {entry.type === 'BANK' ? <CreditCard size={11} /> : <Smartphone size={11} />}
                                            </span>
                                            <span className="text-xs font-bold text-[var(--app-text)] truncate">{entry.name}</span>
                                        </div>
                                        {managerUnlocked && <input type="number" value={entry.software} onChange={e => { const c = [...reconEntries]; c[idx] = { ...c[idx], software: e.target.value }; setReconEntries(c); }} className="w-full px-2 py-1.5 bg-[var(--app-surface-hover)] border border-[var(--app-border)] rounded-lg text-[var(--app-text)] text-xs font-bold text-center outline-none focus:border-[var(--app-primary-strong)]" />}
                                        <input type="number" value={entry.real} onChange={e => { const c = [...reconEntries]; c[idx] = { ...c[idx], real: e.target.value }; setReconEntries(c); }} className="w-full px-2 py-1.5 bg-[var(--app-info-bg)] border border-violet-500/20 rounded-lg text-[var(--app-info)] text-xs font-bold text-center outline-none focus:border-violet-400" />
                                        {managerUnlocked && <span className={clsx('text-xs font-black text-center', cal > 0 ? 'text-[var(--app-success)]' : cal < 0 ? 'text-[var(--app-error)]' : 'text-[var(--app-text-faint)]')}>{cal !== 0 ? (cal > 0 ? '+' : '') + cal.toFixed(0) : '—'}</span>}
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
                                        <div key={l as string} className="flex justify-between text-xs"><span className="text-[var(--app-text-muted)]">{l as string}</span><span className={c as string || 'text-[var(--app-text)] font-bold'}>{v as string}</span></div>
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
