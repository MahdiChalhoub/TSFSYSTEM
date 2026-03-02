"use client";
import { useState, useEffect, useCallback } from 'react';
import { erpFetch } from '@/lib/erp-api';
import {
 BookKey, Verified, AlertTriangle, ShieldAlert,
 Clock, ListFilter, Download, ArrowRightLeft,
 ChevronDown, User, Calendar
} from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';

import { AccountBook } from '@/components/pos/AccountBook';

const formatMoney = (amount: number) => {
 return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(amount);
};

export default function AccountBookManagerPage() {
 const [currency] = useState('XOF');
 const [activeTab, setActiveTab] = useState<'review' | 'snapshots'>('review');

 // Stats
 const [summary, setSummary] = useState({
 pendingCount: 0,
 pendingIn: 0,
 pendingOut: 0
 });

 // Snapshots state
 const [snapshots, setSnapshots] = useState<any[]>([]);
 const [snapshotsLoading, setSnapshotsLoading] = useState(true);

 const [showReviewModal, setShowReviewModal] = useState(false);

 const loadData = useCallback(async () => {
 try {
 const sumRes = await erpFetch('pos-registers/manager-address-book/all-entries/');
 if (sumRes.summary) {
 setSummary(sumRes.summary);
 }

 const snapRes = await erpFetch('pos-registers/manager-address-book/snapshots/');
 if (Array.isArray(snapRes)) {
 setSnapshots(snapRes);
 }
 } catch (e) {
 console.error("Failed to load Account Book manager data", e);
 } finally {
 setSnapshotsLoading(false);
 }
 }, []);

 useEffect(() => { loadData(); }, [loadData]);


 return (
 <div className="flex-1 flex flex-col h-full bg-app-bg relative">
 {/* Header */}
 <header className="flex-none bg-app-surface border-b border-app-border px-6 py-4 flex items-center justify-between sticky top-0 z-20">
 <div>
 <h1 className="text-xl font-black text-app-text flex items-center gap-2">
 <BookKey className="text-emerald-500" size={24} />
 Account Book Audit (Livre de Caisse)
 </h1>
 <p className="text-sm text-app-text-faint font-medium mt-0.5">
 Central authority for approving cashier ledger entries and verifying register variances.
 </p>
 </div>

 <div className="flex bg-gray-100/50 p-1 rounded-xl">
 <button
 onClick={() => setActiveTab('review')}
 className={clsx(
 "px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
 activeTab === 'review'
 ? "bg-app-surface text-app-text shadow-sm"
 : "text-app-text-muted hover:text-app-text"
 )}
 >
 <ShieldAlert size={16} className={activeTab === 'review' ? 'text-amber-500' : ''} />
 Active Review
 {summary.pendingCount > 0 && (
 <span className="ml-1 bg-amber-500 text-app-text text-[10px] px-1.5 py-0.5 rounded-full">
 {summary.pendingCount}
 </span>
 )}
 </button>
 <button
 onClick={() => setActiveTab('snapshots')}
 className={clsx(
 "px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
 activeTab === 'snapshots'
 ? "bg-app-surface text-app-text shadow-sm"
 : "text-app-text-muted hover:text-app-text"
 )}
 >
 <Verified size={16} className={activeTab === 'snapshots' ? 'text-emerald-500' : ''} />
 Daily Snapshots
 </button>
 </div>
 </header>

 {/* Content Area */}
 <main className="flex-1 overflow-y-auto p-6">
 <div className="max-w-6xl mx-auto space-y-6">

 {activeTab === 'review' && (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

 {/* Alert Banner / Call to action */}
 {summary.pendingCount > 0 ? (
 <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
 <div className="p-3 bg-app-surface rounded-xl shadow-sm text-amber-500 mt-1">
 <AlertTriangle size={24} />
 </div>
 <div className="flex-1">
 <h3 className="text-lg font-black text-amber-900">
 {summary.pendingCount} Entries Require Manager Approval
 </h3>
 <p className="text-amber-700/80 text-sm mt-1 max-w-2xl font-medium">
 There are pending money movements across your registers. Until you approve them, they are not posted to the general ledger, and the cashiers' balances may be inaccurate.
 </p>

 <div className="flex gap-4 mt-4">
 <div className="bg-app-text/60 px-4 py-2 rounded-xl flex items-center gap-3">
 <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending IN:</span>
 <span className="font-black text-emerald-600">{formatMoney(summary.pendingIn)}</span>
 </div>
 <div className="bg-app-text/60 px-4 py-2 rounded-xl flex items-center gap-3">
 <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending OUT:</span>
 <span className="font-black text-rose-600">{formatMoney(summary.pendingOut)}</span>
 </div>
 </div>
 </div>
 <button
 onClick={() => setShowReviewModal(true)}
 className="bg-amber-500 text-app-text px-6 py-3 rounded-xl font-black text-sm hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
 >
 Open Audit Modal
 </button>
 </div>
 ) : (
 <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center flex flex-col items-center">
 <div className="w-16 h-16 card-section flex items-center justify-center text-emerald-500 mb-4 animate-bounce">
 <Verified size={32} />
 </div>
 <h3 className="text-xl font-black text-emerald-900">All Clear!</h3>
 <p className="text-emerald-700/80 mt-2 font-medium">There are no pending Account Book entries to review.</p>
 <button
 onClick={() => setShowReviewModal(true)}
 className="mt-6 border border-emerald-200 bg-app-surface text-emerald-700 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-colors"
 >
 Open Audit Modal Anyway
 </button>
 </div>
 )}

 </div>
 )}

 {activeTab === 'snapshots' && (
 <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
 <h3 className="font-bold text-app-text flex items-center gap-2">
 <Clock size={16} className="text-app-text-faint" />
 Historical Register Snapshots
 </h3>
 <div className="flex items-center gap-2">
 <button className="text-app-text-faint hover:text-app-text-muted p-2"><ListFilter size={16} /></button>
 </div>
 </div>

 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="text-[10px] uppercase font-black tracking-wider text-app-text-faint border-b border-app-border bg-app-surface">
 <th className="px-6 py-4">Date</th>
 <th className="px-6 py-4">Register & Cashier</th>
 <th className="px-6 py-4 text-right">IN (Entrées)</th>
 <th className="px-6 py-4 text-right">OUT (Sorties)</th>
 <th className="px-6 py-4 text-right">Variance / Balance</th>
 <th className="px-6 py-4 text-right">Audit Status</th>
 <th className="px-6 py-4 text-right">Action</th>
 </tr>
 </thead>
 <tbody className="text-sm">
 {snapshots.length === 0 ? (
 <tr><td colSpan={7} className="px-6 py-12 text-center text-app-text-faint italic">No snapshots available yet.</td></tr>
 ) : (
 snapshots.map(snap => (
 <tr key={snap.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
 <td className="px-6 py-4">
 <div className="flex items-center gap-2">
 <Calendar size={14} className="text-app-text-faint" />
 <span className="font-bold text-app-text">{snap.date}</span>
 </div>
 </td>
 <td className="px-6 py-4">
 <div className="font-bold text-app-text">{snap.registerName}</div>
 <div className="text-xs text-app-text-muted flex items-center gap-1 mt-0.5">
 <User size={10} /> {snap.cashierName}
 </div>
 </td>
 <td className="px-6 py-4 text-right font-black text-emerald-600">
 {formatMoney(snap.totalIn)}
 </td>
 <td className="px-6 py-4 text-right font-black text-rose-600">
 {formatMoney(snap.totalOut)}
 </td>
 <td className="px-6 py-4 text-right">
 <span className={clsx("font-black px-3 py-1 rounded-lg text-xs",
 snap.balance === 0 ? 'bg-app-surface-2 text-app-text-muted' :
 snap.balance > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
 )}>
 {snap.balance > 0 ? '+' : ''}{formatMoney(snap.balance)}
 </span>
 </td>
 <td className="px-6 py-4 text-right">
 <div className="flex items-center justify-end gap-2 text-[10px] font-bold">
 {snap.approvedCount > 0 && <span className="text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded">✔ {snap.approvedCount}</span>}
 {snap.pendingCount > 0 && <span className="text-amber-500 bg-amber-50 px-2 py-0.5 rounded">⌛ {snap.pendingCount}</span>}
 {snap.rejectedCount > 0 && <span className="text-rose-500 bg-rose-50 px-2 py-0.5 rounded">✖ {snap.rejectedCount}</span>}
 </div>
 </td>
 <td className="px-6 py-4 text-right">
 <button className="text-app-text-faint hover:text-emerald-600 transition-colors p-2 rounded-lg hover:bg-emerald-50 tooltip-trigger" title="Download Immutable PDF">
 <Download size={16} />
 </button>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </main>

 {/* We re-use the exact same modal the POS uses, but run it in Global / Manager mode */}
 {showReviewModal && (
 <AccountBook
 isOpen={showReviewModal}
 onClose={() => {
 setShowReviewModal(false);
 loadData(); // refresh when closed
 }}
 sessionId={undefined as any} // Undefined session ID tells it to fetch ALL (manager view)
 cashierId={undefined as any}
 currency={currency}
 isManager={true}
 />
 )}

 </div>
 );
}
