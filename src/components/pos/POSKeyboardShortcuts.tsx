'use client';

/**
 * POSKeyboardShortcuts — global keyboard handler + `?` shortcut help overlay
 *
 * Mount this once inside any active POS layout. It registers window keydown
 * listeners and fires the matching callbacks.
 *
 * Shortcuts:
 * ? → toggle help overlay
 * / → focus product search (calls onFocusSearch)
 * Escape → close overlays (calls onEscape)
 * Enter → charge (calls onCharge when cart non-empty)
 * F1–F6 → select first 6 payment methods
 * Ctrl+H → hold current cart
 */

import { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutDef {
 keys: string[];
 description: string;
 group: string;
}

const SHORTCUTS: ShortcutDef[] = [
 { keys: ['?'], description: 'Show keyboard shortcuts', group: 'General' },
 { keys: ['/'], description: 'Focus product search', group: 'General' },
 { keys: ['Esc'], description: 'Close open overlay / cancel', group: 'General' },
 { keys: ['Enter'], description: 'Charge (when cart is not empty)', group: 'General' },
 { keys: ['Ctrl', 'H'], description: 'Quick-hold current cart', group: 'General' },
 { keys: ['F1'], description: 'Select payment method 1 (CASH)', group: 'Payments' },
 { keys: ['F2'], description: 'Select payment method 2', group: 'Payments' },
 { keys: ['F3'], description: 'Select payment method 3', group: 'Payments' },
 { keys: ['F4'], description: 'Select payment method 4', group: 'Payments' },
 { keys: ['F5'], description: 'Select payment method 5', group: 'Payments' },
 { keys: ['F6'], description: 'Select payment method 6 (MULTI)', group: 'Payments' },
];

interface POSKeyboardShortcutsProps {
 paymentMethods?: Array<{ key: string; label: string }>;
 cartHasItems: boolean;
 onCharge: () => void;
 onFocusSearch?: () => void;
 onEscape?: () => void;
 onSetPaymentMethod: (method: string) => void;
 onHoldCart?: () => void;
}

export default function POSKeyboardShortcuts({
 paymentMethods = [],
 cartHasItems,
 onCharge,
 onFocusSearch,
 onEscape,
 onSetPaymentMethod,
 onHoldCart,
}: POSKeyboardShortcutsProps) {
 const [showHelp, setShowHelp] = useState(false);

 useEffect(() => {
 const handler = (e: KeyboardEvent) => {
 const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
 const inInput = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable;

 // ? → help overlay (works even in inputs)
 if (e.key === '?' && !inInput) {
 e.preventDefault();
 setShowHelp(s => !s);
 return;
 }

 // Help overlay: Esc to close
 if (e.key === 'Escape') {
 if (showHelp) { setShowHelp(false); return; }
 onEscape?.();
 return;
 }

 // These don't work when typing in inputs
 if (inInput) return;

 if (e.key === '/' || e.key === 'F9') {
 e.preventDefault();
 onFocusSearch?.();
 return;
 }

 if (e.key === 'Enter') {
 if (cartHasItems) {
 e.preventDefault();
 onCharge();
 }
 return;
 }

 if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
 e.preventDefault();
 onHoldCart?.();
 return;
 }

 // F1–F6 → payment methods
 const fIdx = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'].indexOf(e.key);
 if (fIdx !== -1) {
 e.preventDefault();
 const method = paymentMethods[fIdx];
 if (method) onSetPaymentMethod(method.key);
 return;
 }
 };

 window.addEventListener('keydown', handler);
 return () => window.removeEventListener('keydown', handler);
 }, [showHelp, cartHasItems, paymentMethods, onCharge, onFocusSearch, onEscape, onSetPaymentMethod, onHoldCart]);

 if (!showHelp) return null;

 const groups = ['General', 'Payments'];

 return (
 <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
 <div className="bg-app-surface border border-app-foreground/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
 <div className="flex items-center gap-3 px-5 py-4 border-b border-app-foreground/5">
 <Keyboard size={18} className="text-indigo-400" />
 <h2 className="text-app-foreground font-black text-base flex-1">Keyboard Shortcuts</h2>
 <button onClick={() => setShowHelp(false)} className="w-7 h-7 rounded-lg bg-app-foreground/5 hover:bg-app-foreground/10 text-app-foreground/40 hover:text-app-foreground flex items-center justify-center">
 <X size={14} />
 </button>
 </div>
 <div className="p-5 space-y-5">
 {groups.map(group => (
 <div key={group}>
 <div className="text-app-foreground/25 text-[10px] uppercase tracking-widest font-black mb-2">{group}</div>
 <div className="space-y-1.5">
 {SHORTCUTS.filter(s => s.group === group).map(s => (
 <div key={s.description} className="flex items-center justify-between gap-4">
 <span className="text-app-foreground/60 text-sm">{s.description}</span>
 <div className="flex items-center gap-1 shrink-0">
 {s.keys.map(k => (
 <kbd key={k} className="px-2 py-0.5 rounded bg-app-foreground/10 text-app-foreground/80 text-xs font-mono font-bold border border-app-foreground/10">{k}</kbd>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 <p className="text-app-foreground/20 text-xs text-center border-t border-app-foreground/5 pt-3">Press <kbd className="px-1 bg-app-foreground/10 rounded text-app-foreground/40 text-[10px]">?</kbd> to toggle this overlay</p>
 </div>
 </div>
 </div>
 );
}
