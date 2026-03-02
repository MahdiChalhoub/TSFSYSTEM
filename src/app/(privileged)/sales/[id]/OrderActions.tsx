'use client';

import { useState } from 'react';
import { Lock, Unlock, CheckCircle2, AlertCircle } from 'lucide-react';
import { lockOrder, verifyOrder } from '../actions';
import { toast } from 'sonner';

interface OrderActionsProps {
 orderId: number;
 isLocked: boolean;
 isVerified: boolean;
}

export function OrderActions({ orderId, isLocked: initialLocked, isVerified: initialVerified }: OrderActionsProps) {
 const [isLocked, setIsLocked] = useState(initialLocked);
 const [isVerified, setIsVerified] = useState(initialVerified);
 const [loading, setLoading] = useState(false);

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

 return (
 <div className="flex items-center gap-3">
 <button
 onClick={handleVerify}
 disabled={loading}
 className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black transition-all ${isVerified
 ? 'bg-emerald-500 text-app-text shadow-lg shadow-emerald-200 hover:bg-emerald-600'
 : 'bg-app-surface border-2 border-emerald-100 text-emerald-600 hover:bg-emerald-50'
 }`}
 >
 <CheckCircle2 size={18} />
 <span>{isVerified ? 'Vérifié' : 'Vérifier'}</span>
 </button>

 <button
 onClick={handleLock}
 disabled={loading}
 className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black transition-all ${isLocked
 ? 'bg-amber-500 text-app-text shadow-lg shadow-amber-200 hover:bg-amber-600'
 : 'bg-app-surface border-2 border-amber-100 text-amber-600 hover:bg-amber-50'
 }`}
 >
 {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
 <span>{isLocked ? 'Verrouillé' : 'Verrouiller'}</span>
 </button>
 </div>
 );
}
