'use client';

import { useState } from 'react';
import { Lock, Unlock, CheckCircle2, RefreshCw, Shield } from 'lucide-react';
import { lockOrder, verifyOrder } from '../actions';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';

interface OrderActionsProps {
 orderId: number;
 isLocked: boolean;
 isVerified: boolean;
 fneStatus?: string | null;
}

export function OrderActions({ orderId, isLocked: initialLocked, isVerified: initialVerified, fneStatus: initialFneStatus }: OrderActionsProps) {
 const [isLocked, setIsLocked] = useState(initialLocked);
 const [isVerified, setIsVerified] = useState(initialVerified);
 const [fneStatus, setFneStatus] = useState(initialFneStatus);
 const [loading, setLoading] = useState(false);
 const [fneLoading, setFneLoading] = useState(false);

 const handleLock = async () => {
 setLoading(true);
 try {
 const next = !isLocked;
 const res = await lockOrder(orderId, next);
 if (res.success) {
 setIsLocked(next);
 toast.success(next ? "Vente verrouillée" : "Vente déverrouillée");
 } else {
 toast.error(res.error || "Erreur lors du verrouillage");
 }
 } finally {
 setLoading(false);
 }
 };

 const handleVerify = async () => {
 setLoading(true);
 try {
 const next = !isVerified;
 const res = await verifyOrder(orderId, next);
 if (res.success) {
 setIsVerified(next);
 toast.success(next ? "Vente vérifiée" : "Vérification annulée");
 } else {
 toast.error(res.error || "Erreur lors de la vérification");
 }
 } finally {
 setLoading(false);
 }
 };

 const handleRetryFne = async () => {
 setFneLoading(true);
 try {
 const res = await erpFetch(`pos/orders/${orderId}/retry-fne/`, { method: 'POST' });
 if (res.success) {
 setFneStatus('CERTIFIED');
 toast.success(`✓ FNE Certifié: ${res.fne_reference}`, { duration: 5000 });
 // Reload page to show updated QR code
 window.location.reload();
 } else {
 toast.error(res.error || 'Certification FNE échouée');
 }
 } catch (e: any) {
 const msg = e?.message || 'Certification FNE échouée';
 toast.error(msg);
 } finally {
 setFneLoading(false);
 }
 };

 return (
 <div className="flex items-center gap-3 flex-wrap">
 <button
 onClick={handleVerify}
 disabled={loading}
 className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black transition-all ${isVerified
 ? 'bg-app-primary text-app-foreground shadow-lg shadow-emerald-200 hover:bg-app-primary'
 : 'bg-app-surface border-2 border-app-success/30 text-app-primary hover:bg-app-primary-light'
 }`}
 >
 <CheckCircle2 size={18} />
 <span>{isVerified ? 'Vérifié' : 'Vérifier'}</span>
 </button>

 <button
 onClick={handleLock}
 disabled={loading}
 className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black transition-all ${isLocked
 ? 'bg-app-warning text-app-foreground shadow-lg shadow-amber-200 hover:bg-app-warning'
 : 'bg-app-surface border-2 border-app-warning/30 text-app-warning hover:bg-app-warning-bg'
 }`}
 >
 {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
 <span>{isLocked ? 'Verrouillé' : 'Verrouiller'}</span>
 </button>

 {/* FNE Retry Button — only shown for FAILED or PENDING */}
 {fneStatus && fneStatus !== 'CERTIFIED' && (
 <button
 onClick={handleRetryFne}
 disabled={fneLoading}
 className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black transition-all bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
 >
 {fneLoading ? (
 <RefreshCw size={18} className="animate-spin" />
 ) : (
 <Shield size={18} />
 )}
 <span>{fneLoading ? 'Certification en cours...' : 'Retenter FNE'}</span>
 </button>
 )}

 {/* FNE Certified Badge */}
 {fneStatus === 'CERTIFIED' && (
 <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-app-success-bg border-2 border-app-success text-app-success font-black text-sm">
 <Shield size={16} />
 <span>FNE Certifié</span>
 </div>
 )}
 </div>
 );
}
