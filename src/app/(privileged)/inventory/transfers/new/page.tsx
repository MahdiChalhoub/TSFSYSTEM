// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, Trash2, Package , ArrowLeftRight} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { erpFetch } from '@/lib/erp-api';
import { createTransfer } from '@/app/actions/inventory/transfers';
import Link from 'next/link';
import { AppPageHeader } from '@/components/app/ui/AppPageHeader';

interface Warehouse {
 id: number;
 name: string;
 location_type: string;
}

interface Product {
 id: number;
 name: string;
 sku: string;
}

export default function NewTransferPage() {
 const router = useRouter();
 const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
 const [products, setProducts] = useState<Product[]>([]);
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);

 // Form State
 const [fromWh, setFromWh] = useState('');
 const [toWh, setToWh] = useState('');
 const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
 const [notes, setNotes] = useState('');
 const [lines, setLines] = useState<{ id: string, product: string, quantity: string }[]>([
 { id: '1', product: '', quantity: '1' }
 ]);

 useEffect(() => {
 const fetchMeta = async () => {
 try {
 const [whRes, prRes] = await Promise.all([
 erpFetch('inventory/warehouses/'),
 erpFetch('inventory/products/?page_size=1000') // Simplification for MVP
 ]);
 setWarehouses(Array.isArray(whRes) ? whRes : (whRes.results || []));
 setProducts(Array.isArray(prRes) ? prRes : (prRes.results || []));
 } catch (e) {
 toast.error("Failed to load metadata for transfer form.");
 } finally {
 setLoading(false);
 }
 };
 fetchMeta();
 }, []);

 const addLine = () => {
 setLines([...lines, { id: Math.random().toString(), product: '', quantity: '1' }]);
 };

 const removeLine = (id: string) => {
 if (lines.length === 1) return;
 setLines(lines.filter(l => l.id !== id));
 };

 const updateLine = (id: string, field: 'product' | 'quantity', value: string) => {
 setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!fromWh || !toWh) {
 toast.error("Please select both source and destination warehouses.");
 return;
 }

 if (fromWh === toWh) {
 toast.error("Source and destination cannot be the same.");
 return;
 }

 const validLines = lines.filter(l => l.product && parseFloat(l.quantity) > 0);
 if (validLines.length === 0) {
 toast.error("Please add at least one valid product line.");
 return;
 }

 setSubmitting(true);
 toast.loading("Creating transfer order...");

 const result = await createTransfer({
 from_warehouse: parseInt(fromWh),
 to_warehouse: parseInt(toWh),
 scheduled_date: scheduledDate,
 notes,
 lines: validLines.map(l => ({
 product: parseInt(l.product),
 quantity: parseFloat(l.quantity)
 }))
 });

 toast.dismiss();
 if (result.success) {
 toast.success("Draft transfer created successfully!");
 router.push(`/inventory/transfers/${result.data.id}`);
 } else {
 toast.error(result.error || "Failed to create transfer.");
 setSubmitting(false);
 }
 };

 if (loading) {
 return <div className="app-page p-10 text-center text-app-muted-foreground animate-pulse">Loading form requirements...</div>;
 }

 return (
 <div className="min-h-screen p-5 md:p-6 space-y-6 max-w-4xl mx-auto bg-app-background" style={{ color: 'var(--app-foreground)' }}>
  {/* V2 Header */}
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 fade-in-up">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-primary)20', border: `1px solid $var(--app-primary)40` }}>
        <ArrowLeftRight size={26} style={{ color: 'var(--app-primary)' }} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Management</p>
        <h1 className="text-3xl font-black tracking-tight text-app-foreground">New Transfer</h1>
        <p className="text-sm text-app-muted-foreground mt-0.5">Create inter-warehouse transfer</p>
      </div>
    </div>
  </header>
 <AppPageHeader
 title={<>New <span style={{ color: 'var(--app-primary)' }}>Transfer</span></>}
 subtitle="Initiate an inter-warehouse stock movement"
 icon={<Package size={24} color="#fff" />}
 actions={
 <Link href="/inventory/transfers">
 <Button variant="outline" className="rounded-xl font-bold bg-app-surface border-app-border text-app-foreground hover:bg-app-surface-hover">
 <ArrowLeft size={16} className="mr-2" /> Cancel
 </Button>
 </Link>
 }
 />

 <form onSubmit={handleSubmit} className="space-y-6">
 {/* ── Route ─────────────────────────────────────────────────── */}
 <div className="p-6 rounded-2xl border border-app-border bg-app-surface shadow-sm space-y-6">
 <h2 className="text-sm font-black uppercase tracking-widest text-app-muted-foreground">Transfer Route</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-2">
 <label className="text-[10px] font-bold uppercase text-app-muted-foreground">From Warehouse *</label>
 <Select value={fromWh} onValueChange={setFromWh}>
 <SelectTrigger className="bg-app-background border-app-border rounded-xl h-11">
 <SelectValue placeholder="Select Origin" />
 </SelectTrigger>
 <SelectContent className="bg-app-surface border-app-border rounded-xl">
 {warehouses.map(w => (
 <SelectItem key={w.id} value={String(w.id)} disabled={String(w.id) === toWh}>
 {w.name} {w.location_type ? `(${w.location_type})` : ''}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <label className="text-[10px] font-bold uppercase text-app-muted-foreground">To Warehouse *</label>
 <Select value={toWh} onValueChange={setToWh}>
 <SelectTrigger className="bg-app-background border-app-border rounded-xl h-11">
 <SelectValue placeholder="Select Destination" />
 </SelectTrigger>
 <SelectContent className="bg-app-surface border-app-border rounded-xl">
 {warehouses.map(w => (
 <SelectItem key={w.id} value={String(w.id)} disabled={String(w.id) === fromWh}>
 {w.name} {w.location_type ? `(${w.location_type})` : ''}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>

 {/* ── Details ───────────────────────────────────────────────── */}
 <div className="p-6 rounded-2xl border border-app-border bg-app-surface shadow-sm space-y-6">
 <h2 className="text-sm font-black uppercase tracking-widest text-app-muted-foreground">Logistics Details</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-2">
 <label className="text-[10px] font-bold uppercase text-app-muted-foreground">Scheduled Date</label>
 <Input
 type="date"
 value={scheduledDate}
 onChange={e => setScheduledDate(e.target.value)}
 className="bg-app-background border-app-border rounded-xl h-11"
 />
 </div>
 </div>
 <div className="space-y-2">
 <label className="text-[10px] font-bold uppercase text-app-muted-foreground">Internal Notes</label>
 <Textarea
 placeholder="Reason for transfer, driver info, etc."
 value={notes}
 onChange={e => setNotes(e.target.value)}
 className="bg-app-background border-app-border rounded-xl resize-none"
 rows={3}
 />
 </div>
 </div>

 {/* ── Items ─────────────────────────────────────────────────── */}
 <div className="p-6 rounded-2xl border border-app-border bg-app-surface shadow-sm space-y-6">
 <div className="flex items-center justify-between">
 <h2 className="text-sm font-black uppercase tracking-widest text-app-muted-foreground">Transfer Items</h2>
 <Button type="button" onClick={addLine} variant="outline" size="sm" className="rounded-lg h-8 px-3 text-[10px] font-bold border-app-border bg-app-background hover:bg-app-surface-hover">
 <Plus size={14} className="mr-1.5" /> ADD LINE
 </Button>
 </div>

 <div className="space-y-3">
 {lines.map((line, idx) => (
 <div key={line.id} className="flex items-center gap-3 p-3 bg-app-background border border-app-border rounded-xl">
 <span className="text-[10px] font-bold text-app-muted-foreground w-6 text-center">{idx + 1}.</span>
 <div className="flex-1">
 <Select value={line.product} onValueChange={(val) => updateLine(line.id, 'product', val)}>
 <SelectTrigger className="bg-app-surface border-app-border rounded-lg h-10 w-full text-xs">
 <SelectValue placeholder="Search Product..." />
 </SelectTrigger>
 <SelectContent className="bg-app-surface border-app-border rounded-xl">
 {products.map(p => (
 <SelectItem key={p.id} value={String(p.id)} className="text-xs">
 [{p.sku}] {p.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="w-24">
 <Input
 type="number"
 min="0"
 step="0.01"
 value={line.quantity}
 onChange={e => updateLine(line.id, 'quantity', e.target.value)}
 className="bg-app-surface border-app-border text-center rounded-lg h-10 text-xs font-bold"
 />
 </div>
 <Button
 type="button"
 onClick={() => removeLine(line.id)}
 disabled={lines.length === 1}
 variant="ghost"
 className="text-app-error hover:text-app-error hover:bg-app-error-bg rounded-lg h-10 w-10 p-0 shrink-0"
 >
 <Trash2 size={16} />
 </Button>
 </div>
 ))}
 </div>
 </div>

 <div className="flex justify-end gap-3 pt-4">
 <Button type="submit" disabled={submitting} className="bg-app-primary hover:opacity-90 text-app-primary-foreground rounded-xl px-8 h-12 shadow-lg font-bold">
 {submitting ? 'Creating...' : 'Create Draft Transfer'} <Save size={18} className="ml-2" />
 </Button>
 </div>
 </form>
 </div>
 );
}
