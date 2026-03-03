/** Client Portal Admin — Client Orders Review */
import { erpFetch } from "@/lib/erp-api";
import { ShoppingBag, Package, Truck, CheckCircle } from "lucide-react";
import ClientOrdersClient from "./client";

export const dynamic = 'force-dynamic';

async function getOrders() {
 try { return await erpFetch('client-portal/admin-orders/'); } catch { return []; }
}

export default async function ClientOrdersPage() {
 const orders = await getOrders();

 const stats = [
 { label: 'Total Orders', value: orders.length, icon: ShoppingBag, color: '#6366f1' },
 { label: 'Placed', value: orders.filter((o: any) => o.status === 'PLACED').length, icon: Package, color: 'var(--app-warning)' },
 { label: 'In Transit', value: orders.filter((o: any) => o.status === 'SHIPPED').length, icon: Truck, color: 'var(--app-info)' },
 { label: 'Delivered', value: orders.filter((o: any) => o.status === 'DELIVERED').length, icon: CheckCircle, color: 'var(--app-success)' },
 ];

 return (
 <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
  {/* V2 Header */}
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 fade-in-up">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-info)20', border: `1px solid $var(--app-info)40` }}>
        <ShoppingBag size={26} style={{ color: 'var(--app-info)' }} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Management</p>
        <h1 className="text-3xl font-black tracking-tight text-app-foreground">Client Orders</h1>
        <p className="text-sm text-app-muted-foreground mt-0.5">B2B client order management</p>
      </div>
    </div>
  </header>
 <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
 🛒 Client Orders
 </h1>
 <p style={{ color: 'var(--app-muted-foreground)', marginBottom: '1.5rem' }}>
 Review, confirm, process, ship, and deliver client eCommerce orders
 </p>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
 {stats.map(s => (
 <div key={s.label} style={{
 background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
 borderRadius: 12, padding: '1.25rem', border: '1px solid var(--app-surface)',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
 <s.icon size={18} color={s.color} />
 <span style={{ color: 'var(--app-muted-foreground)', fontSize: '0.85rem' }}>{s.label}</span>
 </div>
 <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
 </div>
 ))}
 </div>
 <ClientOrdersClient orders={orders} />
 </div>
 );
}
