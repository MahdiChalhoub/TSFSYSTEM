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
        { label: 'Total Orders', value: orders.length, icon: ShoppingBag, color: 'var(--app-accent)' },
        { label: 'Placed', value: orders.filter((o: any) => o.status === 'PLACED').length, icon: Package, color: 'var(--app-warning)' },
        { label: 'In Transit', value: orders.filter((o: any) => o.status === 'SHIPPED').length, icon: Truck, color: 'var(--app-accent-cyan)' },
        { label: 'Delivered', value: orders.filter((o: any) => o.status === 'DELIVERED').length, icon: CheckCircle, color: 'var(--app-success)' },
    ];

    return (
        <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                🛒 Client Orders
            </h1>
            <p style={{ color: 'var(--app-faint)', marginBottom: '1.5rem' }}>
                Review, confirm, process, ship, and deliver client eCommerce orders
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                {stats.map(s => (
                    <div key={s.label} style={{
                        background: 'linear-gradient(135deg, var(--app-surface-2) 0%, var(--app-bg) 100%)',
                        borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <s.icon size={18} color={s.color} />
                            <span style={{ color: 'var(--app-faint)', fontSize: '0.85rem' }}>{s.label}</span>
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>
            <ClientOrdersClient orders={orders} />
        </div>
    );
}
