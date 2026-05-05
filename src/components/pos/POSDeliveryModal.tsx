'use client';
import { useState, useEffect } from 'react';
import { erpFetch } from '@/lib/erp-api';
import {
 X, MapPin, Phone, User, Home, Truck, ChevronRight,
 ChevronLeft, Check, Loader2, Banknote, CreditCard, Clock,
 AlertTriangle, Package, UserPlus, ArrowRight, Building2,
 Shield, Hash
} from 'lucide-react';
import clsx from 'clsx';

type DeliveryZone = { id: number; name: string; base_fee: string | number };
type Driver = { id: number; username: string; first_name?: string; last_name?: string };

type DeliveryForm = {
 recipient_name: string;
 phone: string;
 address_line1: string;
 address_line2: string;
 city: string;
 zone: number | null;
 payment_mode: 'IMMEDIATE' | 'CREDIT' | 'HOLD';
 driver: number | null;
 notes: string;
 delivery_fee: number;
};

const STEPS = ['Delivery Info', 'Payment', 'Driver', 'Confirm'];

const PAYMENT_MODES = [
 {
 key: 'IMMEDIATE' as const,
 icon: Banknote,
 label: 'Pay at Delivery',
 desc: 'Driver collects full amount on the spot.',
 gradient: 'bg-emerald-gradient',
 ring: 'ring-app-primary/30 border-app-primary/50',
 badge: 'bg-app-primary/10 text-app-primary',
 },
 {
 key: 'HOLD' as const,
 icon: Clock,
 label: 'Hold Session',
 desc: 'Driver returns cash to POS. Session stays live.',
 gradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
 ring: 'ring-amber-500/30 border-app-warning/50',
 badge: 'bg-app-warning-bg text-app-warning',
 },
 {
 key: 'CREDIT' as const,
 icon: CreditCard,
 label: 'Client Credit',
 desc: 'Added to client account. Requires credit authority.',
 gradient: 'bg-gradient-to-br from-indigo-500 to-violet-700',
 ring: 'ring-app-info/30 border-app-info/50',
 badge: 'bg-app-info/10 text-indigo-400',
 },
];

interface POSDeliveryModalProps {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: (deliveryData: DeliveryForm & { delivery_fee: number }) => Promise<void>;
 orderId?: number;
 orderTotal: number;
 currency: string;
 selectedClient?: {
 id?: number;
 name?: string;
 phone?: string;
 address?: string;
 city?: string;
 } | null;
 sessionId?: number | null;
 hasClientCredit?: boolean;
 preSelectedZoneName?: string | null; // Zone pre-selected from customer bar
}

// Walk-in customer IDs / names to detect "no client selected"
const isWalkIn = (client: POSDeliveryModalProps['selectedClient']) => {
 if (!client) return true;
 const name = (client.name || '').toLowerCase();
 return !client.id || client.id === 1 || name.includes('walk') || name.includes('counter');
};

export function POSDeliveryModal({
 isOpen, onClose, onConfirm,
 orderTotal, currency, selectedClient, sessionId, hasClientCredit,
 preSelectedZoneName
}: POSDeliveryModalProps) {
 const [step, setStep] = useState(0);
 const [zones, setZones] = useState<DeliveryZone[]>([]);
 const [drivers, setDrivers] = useState<Driver[]>([]);
 const [loading, setLoading] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [showGate, setShowGate] = useState(false);

 const [form, setForm] = useState<DeliveryForm>({
 recipient_name: '',
 phone: '',
 address_line1: '',
 address_line2: '',
 city: '',
 zone: null,
 payment_mode: 'IMMEDIATE',
 driver: null,
 notes: '',
 delivery_fee: 0,
 });

 useEffect(() => {
 if (!isOpen) return;
 setStep(0);

 // Check if walk-in → show gate screen
 const noClient = isWalkIn(selectedClient);
 setShowGate(noClient);

 // Auto-fill from client
 setForm({
 recipient_name: selectedClient?.name || '',
 phone: selectedClient?.phone || '',
 address_line1: selectedClient?.address || '',
 address_line2: '',
 city: selectedClient?.city || '',
 zone: null,
 payment_mode: 'IMMEDIATE',
 driver: null,
 notes: '',
 delivery_fee: 0,
 });

 loadData();
 }, [isOpen, selectedClient]);

 async function loadData() {
 setLoading(true);
 try {
 const [zonesData, driversData] = await Promise.all([
 erpFetch('pos/delivery-zones/'),
 erpFetch('users/?is_driver=true&is_active=true').catch(() => []),
 ]);
 const zoneList: DeliveryZone[] = Array.isArray(zonesData) ? zonesData : zonesData?.results || [];
 setZones(zoneList);
 setDrivers(Array.isArray(driversData) ? driversData : driversData?.results || []);

 // Auto-select zone from customer bar if one was pre-selected
 if (preSelectedZoneName) {
 const match = zoneList.find(
 z => z.name.toLowerCase() === preSelectedZoneName.toLowerCase()
 );
 if (match) {
 setForm(f => ({ ...f, zone: match.id, delivery_fee: Number(match.base_fee) }));
 }
 }
 } catch { }
 setLoading(false);
 }

 const set = (k: keyof DeliveryForm, v: any) => setForm(f => ({ ...f, [k]: v }));
 const selectedZone = zones.find(z => z.id === form.zone);
 const deliveryFee = selectedZone ? Number(selectedZone.base_fee) : 0;
 const totalWithDelivery = orderTotal + deliveryFee;

 const fmt = (n: number) =>
 `${currency} ${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

 const canNext = () => {
 if (step === 0) return form.recipient_name.trim() && form.phone.trim() && form.address_line1.trim();
 return true;
 };

 async function handleSubmit() {
 setSubmitting(true);
 try {
 await onConfirm({ ...form, delivery_fee: deliveryFee });
 onClose();
 } catch { }
 setSubmitting(false);
 }

 if (!isOpen) return null;

 // ─── Gate Screen: no real client selected ───
 if (showGate) {
 return (
 <div className="fixed inset-0 z-[950] flex items-center justify-center" onClick={onClose}>
 <div className="absolute inset-0 bg-app-bg/80 backdrop-blur-md" />
 <div
 className="relative w-[480px] max-w-[95vw] bg-[#0F172A] rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden border border-app-foreground/10 p-1"
 onClick={e => e.stopPropagation()}
 >
 <div className="bg-app-bg/40 rounded-[2.8rem] px-8 py-10 relative overflow-hidden">
 {/* Header glow */}
 <div className="absolute -top-12 -right-12 w-64 h-64 bg-app-warning-bg rounded-full blur-[80px] pointer-events-none" />

 <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 rounded-2xl bg-app-foreground/5 hover:bg-app-foreground/10 flex items-center justify-center text-app-foreground/40 hover:text-app-foreground transition-all border border-app-foreground/5 group">
 <X size={18} className="group-hover:rotate-90 transition-transform" />
 </button>

 <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-2xl shadow-amber-500/20 mx-auto mb-8 relative">
 <div className="absolute inset-0 bg-app-foreground/10 animate-pulse rounded-[2rem]" />
 <Truck size={36} className="text-app-foreground relative z-10" />
 </div>

 <h2 className="text-center mb-2 uppercase">Client Required</h2>
 <p className="text-app-foreground/40 text-sm text-center mb-8 font-medium max-w-[300px] mx-auto leading-relaxed">
 Delivery requires customer name, phone number, and delivery address.
 </p>

 <div className="space-y-4">
 <button
 onClick={() => setShowGate(false)}
 className="w-full flex items-center gap-5 p-5 bg-app-foreground/5 hover:bg-app-foreground/8 border border-app-foreground/10 hover:border-app-warning/40 rounded-[2rem] text-left transition-all group"
 >
 <div className="w-12 h-12 rounded-2xl bg-app-warning-bg flex items-center justify-center shrink-0 border border-app-warning/20 group-hover:scale-110 transition-transform">
 <Hash size={20} className="text-app-warning" />
 </div>
 <div className="flex-1">
 <p className="text-app-foreground text-[15px] font-black uppercase tracking-tight">Manual Override</p>
 <p className="text-app-foreground/20 text-[10px] font-bold uppercase tracking-widest">Procedural recipient entry</p>
 </div>
 <ArrowRight size={20} className="text-app-foreground/10 group-hover:text-app-warning group-hover:translate-x-1 transition-all" />
 </button>

 <button
 onClick={onClose}
 className="w-full flex items-center gap-5 p-5 bg-app-foreground/5 hover:bg-app-foreground/8 border border-app-foreground/10 hover:border-app-primary/40 rounded-[2rem] text-left transition-all group"
 >
 <div className="w-12 h-12 rounded-2xl bg-app-primary/10 flex items-center justify-center shrink-0 border border-app-primary/20 group-hover:scale-110 transition-transform">
 <User size={20} className="text-app-primary" />
 </div>
 <div className="flex-1">
 <p className="text-app-foreground text-[15px] font-black uppercase tracking-tight">Access Directory</p>
 <p className="text-app-foreground/20 text-[10px] font-bold uppercase tracking-widest">Choose established counterparty</p>
 </div>
 <ArrowRight size={20} className="text-app-foreground/10 group-hover:text-app-primary group-hover:translate-x-1 transition-all" />
 </button>
 </div>
 </div>
 </div>
 </div>
 );
 }

 // ─── Main Modal ───
 return (
 <div className="fixed inset-0 z-[950] flex items-center justify-center" onClick={onClose}>
 <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
 <div
 className="relative w-[600px] max-w-[95vw] bg-[#0F172A] rounded-[3rem] shadow-[0_0_120px_rgba(0,0,0,0.6)] flex flex-col max-h-[90vh] overflow-hidden border border-app-foreground/10"
 onClick={e => e.stopPropagation()}
 >
 {/* ── Premium Header ── */}
 <div className="bg-app-bg/80 backdrop-blur-xl px-10 py-8 shrink-0 relative overflow-hidden border-b border-app-foreground/10">
 {/* Glow */}
 <div className="absolute -top-24 -right-24 w-64 h-64 bg-app-primary/10 rounded-full blur-[90px] pointer-events-none" />

 <div className="flex items-center justify-between relative z-10">
 <div className="flex items-center gap-5">
 <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-gradient flex items-center justify-center shadow-2xl shadow-app-primary/20 border border-app-success/20">
 <Truck size={24} className="text-app-foreground fill-white/20" />
 </div>
 <div>
 <span className="text-[10px] font-black text-app-primary uppercase tracking-[0.4em] block mb-1">Delivery Details</span>
 <h1 className="uppercase">New Delivery</h1>
 </div>
 </div>
 <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-app-foreground/5 hover:bg-app-foreground/10 flex items-center justify-center text-app-foreground/40 hover:text-app-foreground transition-all border border-app-foreground/5">
 <X size={18} />
 </button>
 </div>

 {/* Client banner if auto-filled */}
 {selectedClient?.name && !isWalkIn(selectedClient) && (
 <div className="mt-3 flex items-center gap-2 bg-app-foreground/8 border border-app-foreground/10 rounded-xl px-3 py-2">
 <div className="w-7 h-7 rounded-full bg-app-primary/20 flex items-center justify-center">
 <span className="text-app-primary text-xs font-black">{selectedClient.name[0]}</span>
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-app-foreground text-xs font-bold truncate">{selectedClient.name}</p>
 {selectedClient.phone && <p className="text-app-foreground/40 text-[10px]">{selectedClient.phone}</p>}
 </div>
 <div className="flex items-center gap-1 text-app-primary">
 <Check size={10} />
 <span className="text-[10px] font-bold">Auto-filled</span>
 </div>
 </div>
 )}

 {/* Step indicators */}
 <div className="mt-8 flex items-center gap-2">
 {STEPS.map((s, i) => (
 <div key={i} className="flex-1 flex items-center gap-2">
 <div className={clsx(
 "h-1.5 flex-1 rounded-full transition-all duration-700",
 i === step ? "bg-app-primary shadow-[0_0_10px_rgba(16,185,129,0.5)]" :
 i < step ? "bg-app-primary/40" : "bg-app-foreground/10"
 )} />
 {i === step && (
 <span className="text-[9px] font-black text-app-primary uppercase tracking-[0.2em] whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-500">
 Step {i + 1}: {s}
 </span>
 )}
 </div>
 ))}
 </div>
 </div>

 {/* ── Content ── */}
 <div className="flex-1 overflow-y-auto bg-app-bg/20 p-8">
 {loading ? (
 <div className="flex flex-col items-center justify-center py-20 text-app-muted-foreground">
 <Loader2 size={32} className="animate-spin text-app-primary mb-4 opacity-40" />
 <span className="text-[10px] font-black uppercase tracking-[0.3em]">Loading delivery options...</span>
 </div>
 ) : step === 0 ? (
 /* ─── Step 1: Delivery Info ─── */
 <div className="space-y-6">
 <div className="grid grid-cols-2 gap-6">
 <Field label="Recipient Authority" icon={<User size={12} />} required>
 <Input value={form.recipient_name} onChange={v => set('recipient_name', v)} placeholder="NAME OF RECIPIENT..." />
 </Field>
 <Field label="Communication Line" icon={<Phone size={12} />} required>
 <Input value={form.phone} onChange={v => set('phone', v)} placeholder="+XXX XX XX XX..." type="tel" />
 </Field>
 </div>
 <Field label="Primary Geolocation" icon={<Home size={12} />} required>
 <Input value={form.address_line1} onChange={v => set('address_line1', v)} placeholder="STREET, BUILDING, APARTMENT..." />
 </Field>
 <div className="grid grid-cols-2 gap-6">
 <Field label="Secondary Markers" icon={<Building2 size={12} />}>
 <Input value={form.address_line2} onChange={v => set('address_line2', v)} placeholder="FLOOR, SUITE, LANDMARK..." />
 </Field>
 <Field label="Sector / City">
 <Input value={form.city} onChange={v => set('city', v)} placeholder="OPERATIONAL SECTOR..." />
 </Field>
 </div>

 {/* Zone tiles */}
 <div>
 <label className="flex items-center gap-2 text-[10px] font-black text-app-foreground/30 uppercase tracking-[0.3em] mb-4">
 <MapPin size={12} className="text-app-primary" /> Logistic Sector Selection
 </label>
 {zones.length > 0 ? (
 <div className="grid grid-cols-2 gap-4">
 {zones.map(z => (
 <button key={z.id}
 onClick={() => { set('zone', z.id); set('delivery_fee', Number(z.base_fee)); }}
 className={clsx(
 "flex items-center justify-between px-5 py-4 rounded-[1.8rem] border transition-all relative overflow-hidden group",
 form.zone === z.id
 ? "border-app-primary/50 bg-app-primary/5 shadow-[0_10px_30px_rgba(16,185,129,0.1)]"
 : "border-app-foreground/5 bg-app-surface/[0.02] hover:bg-app-surface/[0.05] hover:border-app-foreground/20"
 )}>
 <div>
 <p className={clsx("text-[13px] font-black uppercase tracking-tight italic", form.zone === z.id ? "text-app-primary" : "text-app-foreground/60")}>{z.name}</p>
 <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest mt-0.5">Surcharge: {fmt(Number(z.base_fee))}</p>
 </div>
 {form.zone === z.id && (
 <div className="w-6 h-6 rounded-full bg-app-primary flex items-center justify-center text-app-foreground animate-in zoom-in-50 duration-300">
 <Check size={14} strokeWidth={4} />
 </div>
 )}
 </button>
 ))}
 </div>
 ) : (
 <div className="flex items-center gap-4 bg-app-warning/5 border border-app-warning/20 rounded-2xl p-5">
 <AlertTriangle size={18} className="text-app-warning" />
 <p className="text-[11px] text-amber-200/60 font-medium">
 No operational sectors defined. Default logistic rates will apply.
 </p>
 </div>
 )}
 </div>

 <Field label="Delivery Notes">
 <textarea
 value={form.notes}
 onChange={e => set('notes', e.target.value)}
 rows={3}
 placeholder="Landmarks, access codes, delivery instructions..."
 className="w-full px-5 py-4 bg-app-foreground/5 border border-app-foreground/10 rounded-[1.8rem] text-[13px] font-medium text-app-foreground outline-none focus:ring-4 focus:ring-app-primary/10 focus:border-app-primary/30 transition-all placeholder:text-app-foreground/5 resize-none shadow-inner"
 />
 </Field>
 </div>

 ) : step === 1 ? (
 /* ─── Step 2: Payment ─── */
 <div className="space-y-4">
 <label className="flex items-center gap-2 text-[10px] font-black text-app-foreground/30 uppercase tracking-[0.3em] mb-4">
 Payment Method
 </label>
 {PAYMENT_MODES.map(m => {
 const Icon = m.icon;
 const blocked = m.key === 'CREDIT' && !hasClientCredit;
 const active = form.payment_mode === m.key && !blocked;
 return (
 <button key={m.key}
 disabled={blocked}
 onClick={() => set('payment_mode', m.key)}
 className={clsx(
 "w-full flex items-center gap-5 p-5 rounded-[2.2rem] border transition-all relative overflow-hidden group mb-4",
 blocked ? "opacity-30 cursor-not-allowed border-app-foreground/5 bg-app-surface/[0.01]" :
 active ? `border-app-primary/50 bg-app-primary/5 shadow-[0_15px_40px_rgba(0,0,0,0.3)] scale-[1.02]` :
 "border-app-foreground/5 bg-app-surface/[0.03] hover:bg-app-surface/[0.06] hover:border-app-foreground/10"
 )}>
 <div className={clsx(
 "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all",
 active ? "bg-emerald-gradient text-app-foreground border-app-foreground/20 shadow-xl" : "bg-app-foreground/5 border-app-foreground/5 text-app-muted-foreground"
 )}>
 <Icon size={24} />
 </div>
 <div className="flex-1 text-left">
 <p className={clsx("text-base font-black uppercase tracking-tight italic", active ? "text-app-foreground" : "text-app-muted-foreground")}>{m.label}</p>
 <p className="text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest mt-1">{m.desc}</p>
 {blocked && <p className="text-[9px] text-app-error font-black mt-2 uppercase tracking-[0.2em] animate-pulse">Insufficient Credit Authority</p>}
 </div>
 {active && (
 <div className="w-8 h-8 rounded-full bg-app-primary flex items-center justify-center text-app-foreground border-2 border-slate-900">
 <Check size={14} strokeWidth={4} />
 </div>
 )}
 </button>
 );
 })}
 </div>

 ) : step === 2 ? (
 /* ─── Step 3: Driver ─── */
 <div className="space-y-4">
 <label className="flex items-center gap-2 text-[10px] font-black text-app-foreground/30 uppercase tracking-[0.3em] mb-4">
 Logic Unit Assignment
 </label>

 <button onClick={() => set('driver', null)}
 className={clsx("w-full flex items-center gap-5 p-5 rounded-[2.2rem] border transition-all",
 form.driver === null ? "border-app-primary/50 bg-app-primary/5 shadow-xl" : "border-app-foreground/5 bg-app-surface/[0.03] hover:bg-app-surface/[0.06]")}>
 <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center border", form.driver === null ? "bg-emerald-gradient border-app-foreground/20 text-app-foreground" : "bg-app-foreground/5 border-app-foreground/5 text-app-muted-foreground")}>
 <Shield size={20} />
 </div>
 <div className="flex-1 text-left">
 <p className={clsx("text-base font-black uppercase tracking-tight italic", form.driver === null ? "text-app-foreground" : "text-app-muted-foreground")}>Deferred Assignment</p>
 <p className="text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest mt-1">Allocate during dispatch phase</p>
 </div>
 {form.driver === null && <Check size={18} className="text-app-primary" strokeWidth={4} />}
 </button>

 {drivers.length > 0 && (
 <div className="grid grid-cols-1 gap-3">
 {drivers.map(d => {
 const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || d.username;
 const active = form.driver === d.id;
 return (
 <button key={d.id} onClick={() => set('driver', d.id)}
 className={clsx("w-full flex items-center gap-5 p-5 rounded-[2.2rem] border transition-all",
 active ? "border-app-primary/50 bg-app-primary/5 shadow-xl" : "border-app-foreground/5 bg-app-surface/[0.02] hover:bg-app-surface/[0.05]")}>
 <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black border transition-all",
 active ? "bg-emerald-gradient border-app-foreground/20 text-app-foreground" : "bg-app-foreground/5 border-app-foreground/5 text-app-muted-foreground")}>
 {name[0]?.toUpperCase()}
 </div>
 <div className="flex-1 text-left">
 <p className={clsx("text-base font-black uppercase tracking-tight italic", active ? "text-app-foreground" : "text-app-muted-foreground")}>{name}</p>
 <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest mt-1">AVAILABLE AGENT</p>
 </div>
 {active && <Check size={18} className="text-app-primary" strokeWidth={4} />}
 </button>
 );
 })}
 </div>
 )}
 </div>

 ) : (
 /* ─── Step 4: Confirm ─── */
 <div className="space-y-6">
 {/* Summary card */}
 <div className="bg-app-bg/80 border border-app-foreground/10 rounded-[2.5rem] p-8 relative overflow-hidden group shadow-2xl">
 {/* Inner Carbon Texture Overlay */}
 <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

 <div className="flex items-center gap-3 mb-6 relative z-10">
 <div className="w-8 h-8 rounded-xl bg-app-primary/10 flex items-center justify-center border border-app-primary/20">
 <Shield size={16} className="text-app-primary" />
 </div>
 <span className="text-[11px] font-black text-app-foreground/40 uppercase tracking-[0.4em]">Order Summary</span>
 </div>
 <div className="space-y-4 relative z-10">
 <Row label="Recipient" value={form.recipient_name} />
 <Row label="Communication" value={form.phone} />
 <Row label="Surface Location" value={[form.address_line1, form.address_line2, form.city].filter(Boolean).join(', ')} />
 {selectedZone && <Row label="Logistics Sector" value={selectedZone.name} />}
 <div className="flex items-center justify-between py-2 border-y border-app-foreground/5 my-2">
 <span className="text-app-foreground/20 text-[10px] font-black uppercase tracking-widest">Settlement</span>
 <span className={clsx("text-[10px] font-black px-4 py-1.5 rounded-full border shadow-xl uppercase tracking-widest",
 form.payment_mode === 'IMMEDIATE' ? "bg-app-primary/10 text-app-primary border-app-primary/20" :
 form.payment_mode === 'HOLD' ? "bg-app-warning-bg text-app-warning border-app-warning/20" :
 "bg-app-info/10 text-indigo-400 border-app-info/20")}>
 {form.payment_mode === 'IMMEDIATE' ? 'Pay at delivery' :
 form.payment_mode === 'HOLD' ? 'Hold session' : 'Credit Terminal'}
 </span>
 </div>
 {form.driver !== null && (
 <Row label="Deployed Agent" value={
 (() => {
 const d = drivers.find(dr => dr.id === form.driver);
 return d ? [d.first_name, d.last_name].filter(Boolean).join(' ') || d.username : '—';
 })()
 } />
 )}
 </div>
 </div>

 {/* Totals */}
 <div className="bg-app-bg/40 border border-app-foreground/5 rounded-[2.5rem] p-8 space-y-3 shadow-inner">
 <div className="flex justify-between items-center">
 <span className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest">Inventory Value</span>
 <span className="text-[13px] font-black text-app-foreground tabular-nums">{fmt(orderTotal)}</span>
 </div>
 {deliveryFee > 0 && (
 <div className="flex justify-between items-center">
 <span className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest">Logistics Surcharge</span>
 <span className="text-[13px] font-black text-app-warning tabular-nums">+ {fmt(deliveryFee)}</span>
 </div>
 )}
 <div className="flex justify-between items-end pt-5 mt-2 border-t border-app-foreground/10">
 <div className="flex flex-col">
 <span className="text-[10px] font-black text-app-primary uppercase tracking-[0.4em] mb-1">Nexus Requirement</span>
 <span className="text-sm font-black text-app-muted-foreground uppercase tracking-widest">Aggregate Settlement</span>
 </div>
 <span className="text-4xl font-black text-app-foreground tracking-tighter tabular-nums">{fmt(totalWithDelivery)}</span>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* ── Footer ── */}
 <div className="flex items-center justify-between px-10 py-8 border-t border-app-foreground/5 bg-app-bg/80 backdrop-blur-xl shrink-0">
 {step > 0 ? (
 <button onClick={() => setStep(s => s - 1)}
 className="flex items-center gap-3 px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-app-muted-foreground hover:text-app-foreground hover:bg-app-foreground/5 rounded-2xl transition-all border border-transparent hover:border-app-foreground/10">
 <ChevronLeft size={16} /> Operational Regression
 </button>
 ) : <div />}

 {step < STEPS.length - 1 ? (
 <button onClick={() => setStep(s => s + 1)}
 disabled={!canNext()}
 className="flex items-center gap-4 px-10 py-4 bg-app-foreground/5 hover:bg-app-foreground/10 border border-app-foreground/10 text-app-foreground rounded-[2rem] text-[11px] font-black uppercase tracking-[0.4em] disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-xl active:scale-95">
 Advance Sequence <ChevronRight size={16} />
 </button>
 ) : (
 <button onClick={handleSubmit} disabled={submitting}
 className="flex items-center gap-5 px-10 py-5 bg-emerald-gradient text-app-foreground rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.4em] hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-app-primary/20 border border-app-success/30">
 {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={20} strokeWidth={4} />}
 Confirm Delivery
 </button>
 )}
 </div>
 </div>
 </div>
 );
}

// ── Sub-components ──
function Field({ label, icon, required, children }: { label: string; icon?: React.ReactNode; required?: boolean; children: React.ReactNode }) {
 return (
 <div>
 <label className="flex items-center gap-2 text-[10px] font-black text-app-foreground/30 uppercase tracking-[0.3em] mb-2 px-1">
 <span className="text-app-primary opacity-50">{icon}</span> {label} {required && <span className="text-app-primary">*</span>}
 </label>
 {children}
 </div>
 );
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
 return (
 <input
 type={type}
 value={value}
 onChange={e => onChange(e.target.value)}
 placeholder={placeholder}
 className="w-full px-6 py-4 bg-app-foreground/5 border border-app-foreground/10 rounded-[1.8rem] text-[13px] font-medium text-app-foreground outline-none focus:ring-4 focus:ring-app-primary/10 focus:border-app-primary/30 transition-all placeholder:text-app-foreground/5 shadow-inner"
 />
 );
}

function Row({ label, value }: { label: string; value: string }) {
 return (
 <div className="flex items-start justify-between gap-4">
 <span className="text-app-foreground/20 text-[10px] font-black uppercase tracking-widest shrink-0">{label}</span>
 <span className="text-app-foreground text-xs font-bold text-right italic uppercase tracking-tight">{value || 'UNSPECIFIED'}</span>
 </div>
 );
}
