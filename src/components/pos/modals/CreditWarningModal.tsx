'use client';

import React from 'react';
import clsx from 'clsx';

interface CreditWarningModalProps {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: () => void;
 amount: number;
 currency: string;
}

export function CreditWarningModal({ isOpen, onClose, onConfirm, amount, currency }: CreditWarningModalProps) {
 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
 <div className="bg-app-surface rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden">
 {/* Amber header bar */}
 <div className="bg-app-warning px-6 py-5 flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-app-text/20 flex items-center justify-center shrink-0">
 <span className="text-2xl">⚠️</span>
 </div>
 <div className="text-app-text">
 <h2 className="text-xl font-black">Credit Sale Warning</h2>
 <p className="text-amber-100 text-sm">No cash collected — client will owe this amount</p>
 </div>
 </div>

 <div className="px-6 py-6 space-y-4">
 {/* Amount owed */}
 <div className="bg-app-warning-bg border border-app-warning rounded-2xl p-4 text-center">
 <p className="text-xs font-bold text-app-warning uppercase tracking-widest mb-1">Amount to be credited to client account</p>
 <p className="text-4xl font-black text-app-warning tabular-nums">{currency}{amount.toFixed(2)}</p>
 </div>

 {/* Warning text */}
 <div className="space-y-2 text-sm text-app-text-muted">
 <p className="flex items-start gap-2">
 <span className="shrink-0 mt-0.5">📋</span>
 <span>This order will be recorded as a <strong>credit sale</strong>. The client's account will be debited — they owe this amount.</span>
 </p>
 <p className="flex items-start gap-2">
 <span className="shrink-0 mt-0.5">💳</span>
 <span>No cash, card, or wallet payment is collected at this time.</span>
 </p>
 <p className="flex items-start gap-2">
 <span className="shrink-0 mt-0.5">📒</span>
 <span>The debt will show in the client's outstanding balance and accounts receivable.</span>
 </p>
 </div>

 {/* Confirm / Cancel */}
 <div className="flex gap-3 pt-2">
 <button
 onClick={onClose}
 className="flex-1 py-3.5 border-2 border-app-border rounded-2xl text-app-text font-bold text-sm hover:bg-app-bg transition-all font-inter"
 >
 Cancel
 </button>
 <button
 onClick={onConfirm}
 className="flex-1 py-3.5 bg-app-warning hover:bg-app-warning text-app-text rounded-2xl font-black text-sm shadow-lg shadow-amber-200 transition-all font-inter"
 >
 ✓ Confirm Credit Sale
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}
