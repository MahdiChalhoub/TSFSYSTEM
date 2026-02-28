'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
    Truck, MapPin, CheckCircle, AlertCircle, Loader2, Navigation,
    Package, User, Phone, Hash, ArrowRight, Lock, KeyRound
} from 'lucide-react';

interface DeliveryDetail {
    id: number;
    status: string;
    recipient_name: string | null;
    phone: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    amount_due: string;
    payment_mode: string;
    // Code 1: Register ↔ Driver
    require_pos_return_code: boolean;
    pos_return_code: string | null;
    // Code 2: Driver ↔ Client
    require_client_delivery_code: boolean;
    client_delivery_code: string | null;
    driver_latitude: string | null;
    driver_longitude: string | null;
    zone_name: string | null;
    order_ref: string | null;
    order_total: string | null;
    delivered_at: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function apiCall(url: string, method = 'GET', body?: any) {
    const res = await fetch(`${API_BASE}/api/pos/deliveries/${url}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export default function DriverDeliveryPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const id = params?.id as string;
    const token = searchParams?.get('token') || '';

    const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Code 2: client → driver
    const [clientCode, setClientCode] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // GPS
    const [gpsUpdating, setGpsUpdating] = useState(false);
    const [gpsStatus, setGpsStatus] = useState<'idle' | 'ok' | 'error'>('idle');

    const loadDelivery = useCallback(async () => {
        try {
            const data = await apiCall(`${id}/driver_view/?token=${token}`);
            setDelivery(data);
        } catch (e: any) {
            setError(e.message || 'Could not load delivery');
        } finally {
            setLoading(false);
        }
    }, [id, token]);

    useEffect(() => { loadDelivery(); }, [loadDelivery]);

    const handleUpdateGPS = async () => {
        if (!navigator.geolocation) { setGpsStatus('error'); return; }
        setGpsUpdating(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    await apiCall(`${id}/update_location/?token=${token}`, 'POST', {
                        lat: pos.coords.latitude, lng: pos.coords.longitude,
                    });
                    setGpsStatus('ok');
                } catch { setGpsStatus('error'); }
                finally { setGpsUpdating(false); }
            },
            () => { setGpsStatus('error'); setGpsUpdating(false); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleConfirmDelivery = async () => {
        if (!delivery) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            await apiCall(`${id}/submit_code/?token=${token}`, 'POST',
                delivery.require_client_delivery_code ? { code: clientCode } : {}
            );
            setSuccess(true);
        } catch (e: any) {
            setSubmitError(e.message || 'Invalid code');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-white">
                    <Loader2 className="animate-spin" size={36} />
                    <p className="text-sm font-medium opacity-70">Loading delivery...</p>
                </div>
            </div>
        );
    }

    if (error && !delivery) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-900 to-slate-900 flex items-center justify-center p-6">
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 text-center max-w-sm w-full">
                    <Lock className="mx-auto mb-4 text-red-300" size={48} />
                    <h1 className="text-white text-xl font-black mb-2">Access Denied</h1>
                    <p className="text-red-200 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    if (!delivery) return null;

    const isDelivered = delivery.status === 'DELIVERED';
    const amountDue = parseFloat(delivery.amount_due || '0');

    if (isDelivered || success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-teal-900 flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="text-white" size={56} />
                    </div>
                    <h1 className="text-white text-3xl font-black mb-2">Delivered! 🎉</h1>
                    <p className="text-emerald-200">
                        {delivery.recipient_name && `Delivered to ${delivery.recipient_name}.`}
                    </p>
                    <p className="text-emerald-300 text-sm mt-2 opacity-70">Order #{delivery.order_ref}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white">
            {/* Header */}
            <div className="bg-white/5 border-b border-white/10 px-5 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                    <Truck size={20} className="text-white" />
                </div>
                <div>
                    <h1 className="text-sm font-black">Delivery Driver View</h1>
                    <p className="text-[11px] text-white/50">Order #{delivery.order_ref || delivery.id}</p>
                </div>
                <span className={`ml-auto text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${delivery.status === 'IN_TRANSIT' ? 'bg-blue-500/30 text-blue-300' :
                        delivery.status === 'PENDING' ? 'bg-amber-500/30 text-amber-300' :
                            'bg-slate-500/30 text-slate-300'
                    }`}>{delivery.status}</span>
            </div>

            <div className="px-5 py-5 space-y-4 max-w-md mx-auto">
                {/* Recipient */}
                <div className="bg-white/8 rounded-2xl p-4 border border-white/10">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Recipient</p>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                            <User size={15} className="text-indigo-300 shrink-0" />
                            <span className="text-base font-bold">{delivery.recipient_name || '—'}</span>
                        </div>
                        {delivery.phone && (
                            <a href={`tel:${delivery.phone}`} className="flex items-center gap-2.5 text-emerald-300">
                                <Phone size={15} className="shrink-0" />
                                <span className="text-sm font-medium">{delivery.phone}</span>
                            </a>
                        )}
                        {delivery.address_line1 && (
                            <div className="flex items-start gap-2.5">
                                <MapPin size={15} className="text-amber-300 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm">{delivery.address_line1}</p>
                                    {delivery.city && <p className="text-xs text-white/60">{delivery.city}</p>}
                                    {delivery.zone_name && <p className="text-xs text-white/40">Zone: {delivery.zone_name}</p>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment + POS Return Code */}
                <div className="bg-white/8 rounded-2xl p-4 border border-white/10">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Payment</p>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-2xl font-black">{amountDue.toFixed(2)}</p>
                            <p className="text-xs text-white/40">
                                {delivery.payment_mode === 'IMMEDIATE' ? 'Collect from client' :
                                    delivery.payment_mode === 'HOLD' ? 'Bring cash back to POS' : 'Credit — no collection'}
                            </p>
                        </div>
                        <Package size={30} className="text-white/20" />
                    </div>
                    {/* 🔑 Code 1: Register ↔ Driver — shown to driver, give to cashier */}
                    {delivery.require_pos_return_code && delivery.pos_return_code && (
                        <div className="mt-3 bg-indigo-900/60 border border-indigo-500/30 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <KeyRound size={12} className="text-indigo-300" />
                                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Your Return Code</span>
                            </div>
                            <p className="text-3xl font-black text-white tracking-[0.35em] text-center py-1">
                                {delivery.pos_return_code}
                            </p>
                            <p className="text-[10px] text-indigo-300/70 text-center mt-1">
                                Give this code to the cashier when you return with the cash
                            </p>
                        </div>
                    )}
                </div>

                {/* GPS Share */}
                <button
                    onClick={handleUpdateGPS}
                    disabled={gpsUpdating}
                    className="w-full py-3 px-4 rounded-2xl bg-indigo-600/60 border border-indigo-500/40 flex items-center justify-between active:scale-98 transition-all disabled:opacity-60"
                >
                    <div className="flex items-center gap-2.5">
                        <Navigation size={16} className={gpsUpdating ? 'animate-pulse text-indigo-300' : 'text-indigo-300'} />
                        <span className="text-sm font-bold">{gpsUpdating ? 'Getting location...' : 'Share my location'}</span>
                    </div>
                    {gpsStatus === 'ok' && <CheckCircle size={16} className="text-emerald-400" />}
                    {gpsStatus === 'error' && <AlertCircle size={16} className="text-red-400" />}
                    {gpsStatus === 'idle' && !gpsUpdating && <ArrowRight size={16} className="text-white/30" />}
                </button>

                {/* 🔑 Code 2: Driver ↔ Client — driver enters code from client */}
                <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/30 rounded-2xl p-5 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-1">
                        <Hash size={14} className="text-amber-300" />
                        <p className="text-[11px] font-black text-amber-300 uppercase tracking-widest">Confirm Delivery</p>
                    </div>

                    {delivery.require_client_delivery_code ? (
                        <>
                            <p className="text-xs text-white/50 mb-4">
                                Ask the client for their <span className="font-bold text-amber-300">6-digit confirmation code</span> and enter it below.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    value={clientCode}
                                    onChange={e => setClientCode(e.target.value.slice(0, 6))}
                                    placeholder="000000"
                                    className="flex-1 bg-white/10 border border-white/15 rounded-xl px-4 py-3.5 text-2xl font-black text-center tracking-[0.3em] placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                                />
                                <button
                                    onClick={handleConfirmDelivery}
                                    disabled={submitting || clientCode.length < 4}
                                    className="px-5 rounded-xl bg-amber-500 text-white font-black text-sm hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
                                >
                                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                </button>
                            </div>
                            {submitError && (
                                <p className="text-red-400 text-xs mt-2 font-bold flex items-center gap-1">
                                    <AlertCircle size={12} /> {submitError}
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <p className="text-xs text-white/50 mb-4">No client code required. Tap to confirm delivery.</p>
                            <button
                                onClick={handleConfirmDelivery}
                                disabled={submitting}
                                className="w-full py-4 rounded-xl bg-emerald-500 text-white font-black text-base hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                                Confirm Delivery
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
