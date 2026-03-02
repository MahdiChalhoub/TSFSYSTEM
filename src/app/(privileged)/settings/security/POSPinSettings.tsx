'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';
import { Hash, Shield, Eye, EyeOff, Loader2, Check, AlertTriangle } from 'lucide-react';

interface POSPinSettingsProps {
 userId: number;
 hasPosPin: boolean;
 hasOverridePin: boolean;
 /** If true, show Manager Override PIN section (only for staff/managers) */
 canSetOverride: boolean;
}

export function POSPinSettings({ userId, hasPosPin, hasOverridePin, canSetOverride }: POSPinSettingsProps) {
 const [posPin, setPosPin] = useState('');
 const [overridePin, setOverridePin] = useState('');
 const [showPos, setShowPos] = useState(false);
 const [showOverride, setShowOverride] = useState(false);
 const [savingPos, setSavingPos] = useState(false);
 const [savingOverride, setSavingOverride] = useState(false);
 const [posDone, setPosDone] = useState(false);
 const [overrideDone, setOverrideDone] = useState(false);

 const handleSetPosPin = async () => {
 if (!posPin || posPin.length < 4 || posPin.length > 6 || !/^\d+$/.test(posPin)) {
 toast.error('PIN must be 4–6 digits'); return;
 }
 setSavingPos(true);
 try {
 const res = await erpFetch('pos-registers/set-pin/', {
 method: 'POST',
 body: JSON.stringify({ user_id: userId, pin: posPin }),
 });
 if (res?.error) toast.error(res.error);
 else {
 toast.success('Cashier PIN updated!');
 setPosPin('');
 setPosDone(true);
 }
 } catch { toast.error('Failed to save PIN'); }
 setSavingPos(false);
 };

 const handleSetOverridePin = async () => {
 if (!overridePin || overridePin.length < 4 || overridePin.length > 6 || !/^\d+$/.test(overridePin)) {
 toast.error('PIN must be 4–6 digits'); return;
 }
 setSavingOverride(true);
 try {
 const res = await erpFetch('pos-registers/set-override-pin/', {
 method: 'POST',
 body: JSON.stringify({ user_id: userId, pin: overridePin }),
 });
 if (res?.error) toast.error(res.error);
 else {
 toast.success('Manager Override PIN updated!');
 setOverridePin('');
 setOverrideDone(true);
 }
 } catch { toast.error('Failed to save override PIN'); }
 setSavingOverride(false);
 };

 return (
 <div className="bg-app-surface p-8 rounded-[2rem] border border-app-border shadow-sm space-y-6">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-indigo-50 rounded-2xl">
 <Hash className="text-indigo-600" size={24} />
 </div>
 <div>
 <h2 className="text-lg font-black text-app-text uppercase tracking-tighter">POS Access PINs</h2>
 <p className="text-xs text-app-text-faint font-medium tracking-tight">Manage your Point of Sale login and authorization PINs</p>
 </div>
 </div>

 {/* Cashier PIN */}
 <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-3">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-black text-indigo-900">Cashier PIN</p>
 <p className="text-[11px] text-indigo-500">Used to log into a POS register terminal</p>
 </div>
 {(posDone || hasPosPin) ? (
 <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
 <Check size={10} /> Set
 </span>
 ) : (
 <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
 <AlertTriangle size={10} /> Not set
 </span>
 )}
 </div>
 <div className="flex items-center gap-2">
 <div className="relative flex-1">
 <input
 type={showPos ? 'text' : 'password'}
 inputMode="numeric"
 value={posPin}
 onChange={e => setPosPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
 placeholder={hasPosPin || posDone ? 'Enter new PIN to change' : 'Enter 4–6 digit PIN'}
 maxLength={6}
 className="w-full px-4 py-2.5 bg-app-surface border border-indigo-200 rounded-xl text-sm font-mono font-bold text-app-text outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 tracking-[0.3em] text-center transition-all"
 />
 <button onClick={() => setShowPos(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-app-text-muted transition-colors">
 {showPos ? <EyeOff size={16} /> : <Eye size={16} />}
 </button>
 </div>
 <button
 onClick={handleSetPosPin}
 disabled={savingPos || posPin.length < 4}
 className="px-5 py-2.5 bg-indigo-500 text-white rounded-xl font-bold text-sm hover:bg-indigo-600 disabled:opacity-40 transition-all flex items-center gap-2 shrink-0"
 >
 {savingPos ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
 Save
 </button>
 </div>
 </div>

 {/* Manager Override PIN — only shown if user can set it */}
 {canSetOverride && (
 <div className="p-5 bg-rose-50/60 rounded-2xl border border-rose-100 space-y-3">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-black text-rose-900 flex items-center gap-2">
 <Shield size={14} className="text-rose-500" />
 Manager Override PIN
 </p>
 <p className="text-[11px] text-rose-400">
 Authorizes: void, refund, discount, price override, clear cart, qty decrease
 </p>
 </div>
 {(overrideDone || hasOverridePin) ? (
 <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
 <Check size={10} /> Active
 </span>
 ) : (
 <span className="flex items-center gap-1 text-[10px] font-bold text-app-text-muted bg-app-surface-2 px-2 py-1 rounded-full">
 Not set
 </span>
 )}
 </div>
 <div className="flex items-center gap-2">
 <div className="relative flex-1">
 <input
 type={showOverride ? 'text' : 'password'}
 inputMode="numeric"
 value={overridePin}
 onChange={e => setOverridePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
 placeholder={hasOverridePin || overrideDone ? 'Enter new override PIN' : 'Enter 4–6 digit PIN'}
 maxLength={6}
 className="w-full px-4 py-2.5 bg-app-surface border border-rose-200 rounded-xl text-sm font-mono font-bold text-app-text outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 tracking-[0.3em] text-center transition-all"
 />
 <button onClick={() => setShowOverride(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-app-text-muted transition-colors">
 {showOverride ? <EyeOff size={16} /> : <Eye size={16} />}
 </button>
 </div>
 <button
 onClick={handleSetOverridePin}
 disabled={savingOverride || overridePin.length < 4}
 className="px-5 py-2.5 bg-rose-500 text-white rounded-xl font-bold text-sm hover:bg-rose-600 disabled:opacity-40 transition-all flex items-center gap-2 shrink-0"
 >
 {savingOverride ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
 Save
 </button>
 </div>
 </div>
 )}

 <p className="text-[10px] text-app-text-faint font-medium">
 PINs are 4–6 digits and hashed securely. Existing PINs cannot be viewed — only replaced.
 </p>
 </div>
 );
}
