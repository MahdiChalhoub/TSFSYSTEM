'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import { Package, Loader2, Lock } from 'lucide-react';
import { useHasPermission } from '@/hooks/use-permissions';

interface ConfirmOrderDialogProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onConfirm: (warehouseId: string | null) => Promise<void>;
 title?: string;
 defaultWarehouseId?: string | number | null;
}

export function ConfirmOrderDialog({ open, onOpenChange, onConfirm, title = "Confirm Order", defaultWarehouseId }: ConfirmOrderDialogProps) {
 const [warehouses, setWarehouses] = useState<any[]>([]);
 const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
 const [loading, setLoading] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 // Check if the user has permission to change the default fulfillment warehouse
 // (Admins bypass this automatically via the hook)
 const canChangeWarehouse = useHasPermission('sales.change_fulfillment_warehouse');

 useEffect(() => {
 if (open) {
 loadWarehouses();
 }
 }, [open, defaultWarehouseId]);

 async function loadWarehouses() {
 setLoading(true);
 try {
 const data = await erpFetch('inventory/warehouses/?location_type=WAREHOUSE');
 const list = Array.isArray(data) ? data : data.results || [];
 const sellable = list.filter((w: any) => w.can_sell !== false);
 setWarehouses(sellable);

 const defaultStr = defaultWarehouseId?.toString();
 if (defaultStr && sellable.some((w: any) => w.id.toString() === defaultStr)) {
 setSelectedWarehouseId(defaultStr);
 } else if (sellable.length > 0) {
 setSelectedWarehouseId(sellable[0].id.toString());
 } else {
 setSelectedWarehouseId('');
 }
 } catch (e) {
 toast.error('Failed to load warehouses');
 } finally {
 setLoading(false);
 }
 }

 const handleConfirm = async () => {
 setSubmitting(true);
 try {
 await onConfirm(selectedWarehouseId || null);
 onOpenChange(false);
 } catch (e: any) {
 // Errors handled by parent component's handleWorkflow wrapper
 } finally {
 setSubmitting(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-[425px]">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Package size={18} className="text-app-primary" />
 {title}
 </DialogTitle>
 <DialogDescription>
 Select the fulfillment warehouse for this order. Stock will be reserved from this location.
 </DialogDescription>
 </DialogHeader>
 <div className="py-4">
 <label className="text-xs font-bold text-app-text-faint uppercase mb-2 block">
 Fulfillment Warehouse
 </label>
 {loading ? (
 <div className="h-12 bg-app-surface border border-app-border rounded-xl animate-pulse flex items-center justify-center">
 <Loader2 size={16} className="animate-spin text-app-text-faint" />
 </div>
 ) : (
 <div className="relative">
 <select
 value={selectedWarehouseId}
 onChange={(e) => setSelectedWarehouseId(e.target.value)}
 disabled={loading || submitting || !canChangeWarehouse}
 className={`w-full bg-app-surface border border-app-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary appearance-none ${!canChangeWarehouse ? 'opacity-70 cursor-not-allowed bg-app-surface-2' : ''}`}
 >
 <option value="">-- No specific warehouse / Auto --</option>
 {warehouses.map(w => (
 <option key={w.id} value={w.id}>
 {w.name} {w.location_type ? `(${w.location_type})` : ''}
 </option>
 ))}
 </select>

 {!canChangeWarehouse && (
 <div className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-faint flex items-center gap-2">
 <Lock size={14} />
 <span className="text-[10px] font-bold uppercase">Locked to Terminal</span>
 </div>
 )}
 {canChangeWarehouse && (
 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-app-text-faint">
 <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
 <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 </div>
 )}
 </div>
 )}
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
 Cancel
 </Button>
 <Button onClick={handleConfirm} disabled={submitting || loading} className="bg-app-primary hover:bg-emerald-700 text-app-text shadow-lg shadow-emerald-200">
 {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
 {submitting ? 'Confirming...' : 'Confirm Order'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
