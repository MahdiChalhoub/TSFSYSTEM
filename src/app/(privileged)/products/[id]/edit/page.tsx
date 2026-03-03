import { Package, Tag, Layers, Barcode, Globe, Info } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';
import { ProductActivityFeed } from '@/components/modules/inventory/ProductActivityFeed';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProductEditPage(props: { params: Promise<{ id: string }> }) {
 const params = await props.params;
 const { id } = params;

 let product = null;
 try {
 product = await erpFetch(`inventory/products/${id}/`);
 } catch (e) {
 return (
 <div className="app-page p-10 text-center text-app-error">
 <h1>Product Not Found (ID: {id})</h1>
 </div>
 );
 }

 const totalStock = product.inventory?.reduce((acc: number, inv: any) => acc + Number(inv.quantity), 0) || 0;

 return (
 <div className="max-w-5xl mx-auto p-5 md:p-6 space-y-6">
 <Link href="/products" className="inline-flex items-center text-sm font-semibold text-app-muted-foreground hover:text-app-primary transition-colors">
 <ChevronLeft size={16} className="mr-1" /> Back to Products
 </Link>

 {/* Header */}
 <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div className="flex items-center gap-4">
 <div className="w-16 h-16 rounded-2xl bg-app-primary-light flex items-center justify-center border border-app-success shadow-sm">
 <Package size={32} className="text-app-success" />
 </div>
 <div>
 <h1 className="text-3xl font-black tracking-tighter text-app-foreground flex items-center gap-3">
 {product.name}
 <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${product.isActive ? 'bg-app-primary-light text-app-success' : 'bg-app-error-bg text-app-error'}`}>
 {product.isActive ? 'Active' : 'Archived'}
 </span>
 </h1>
 <p className="text-sm font-semibold text-app-muted-foreground flex items-center gap-2 mt-1 uppercase tracking-wider">
 <Barcode size={14} /> {product.sku} <span className="text-app-muted-foreground">|</span>
 {product.barcode || 'NO BARCODE'}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-4 text-right">
 <div className="flex flex-col items-end">
 <span className="text-sm font-bold text-app-muted-foreground uppercase tracking-widest">Available Stock</span>
 <span className={`text-3xl font-black tracking-tighter ${totalStock > 0 ? 'text-app-primary' : 'text-app-error'}`}>
 {totalStock.toLocaleString()} <span className="text-sm text-app-muted-foreground">{product.unit?.shortName || 'UNIT'}</span>
 </span>
 {(product.incoming_transfer_qty > 0 || product.outgoing_transfer_qty > 0) && (
 <div className="flex gap-2 mt-1">
 {product.incoming_transfer_qty > 0 && <span className="text-[10px] font-black uppercase text-app-info bg-app-info-bg border border-app-info/30 px-1.5 py-0.5 rounded shadow-sm">+{product.incoming_transfer_qty} Inbound</span>}
 {product.outgoing_transfer_qty > 0 && <span className="text-[10px] font-black uppercase text-app-warning bg-app-warning-bg border border-app-warning/30 px-1.5 py-0.5 rounded shadow-sm">-{product.outgoing_transfer_qty} Outbound</span>}
 </div>
 )}
 </div>
 </div>
 </header>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Left Column: Details */}
 <div className="lg:col-span-1 space-y-6">
 <div className="app-card p-5 bg-app-surface border border-app-border rounded-xl shadow-sm space-y-4">
 <h3 className="text-sm font-black uppercase tracking-widest text-app-muted-foreground flex items-center gap-2">
 <Info size={16} /> Details
 </h3>

 <div className="space-y-3">
 <div className="flex flex-col">
 <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Brand</span>
 <span className="text-sm font-bold text-app-foreground flex items-center gap-1.5"><Tag size={12} className="text-app-primary" /> {product.brand?.name || 'Generic'}</span>
 </div>
 <div className="flex flex-col">
 <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Category</span>
 <span className="text-sm font-bold text-app-foreground flex items-center gap-1.5"><Layers size={12} className="text-app-primary" /> {product.category?.name || 'Uncategorized'}</span>
 </div>
 <div className="flex flex-col">
 <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Origin Country</span>
 <span className="text-sm font-bold text-app-foreground flex items-center gap-1.5"><Globe size={12} className="text-app-primary" /> {product.country?.name || 'Global'}</span>
 </div>
 <div className="flex flex-col">
 <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Base Cost (HT)</span>
 <span className="text-sm font-mono font-bold text-app-foreground">${Number(product.costPriceHt).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
 </div>
 <div className="flex flex-col">
 <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Selling Price (TTC)</span>
 <span className="text-xl font-mono font-black text-app-primary">${Number(product.sellingPriceTtc).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Right Column: Activity Feed */}
 <div className="lg:col-span-2 space-y-6">
 <div className="app-card p-5 bg-app-surface border border-app-border rounded-xl shadow-sm h-full">
 <ProductActivityFeed productId={id} />
 </div>
 </div>
 </div>
 </div>
 );
}
