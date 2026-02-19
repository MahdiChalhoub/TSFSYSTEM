/** Supplier Portal Admin — Price Change Request Review */
import { erpFetch } from "@/lib/erp-api";
import { DollarSign, TrendingUp, TrendingDown, Clock } from "lucide-react";
import PriceRequestClient from "./client";

export const dynamic = 'force-dynamic';

async function getRequests() {
    try { return await erpFetch('supplier-portal/admin-price-requests/'); } catch { return []; }
}

export default async function PriceRequestPage() {
    const requests = await getRequests();

    const pending = requests.filter((r: any) => r.status === 'PENDING').length;
    const increases = requests.filter((r: any) => r.proposed_price > r.current_price).length;
    const decreases = requests.filter((r: any) => r.proposed_price < r.current_price).length;

    const stats = [
        { label: 'Total Requests', value: requests.length, icon: DollarSign, color: '#6366f1' },
        { label: 'Pending Review', value: pending, icon: Clock, color: '#f59e0b' },
        { label: 'Price Increases', value: increases, icon: TrendingUp, color: '#ef4444' },
        { label: 'Price Decreases', value: decreases, icon: TrendingDown, color: '#22c55e' },
    ];

    return (
        <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                💰 Price Change Requests
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
                Review supplier price change proposals. Approve, reject, or send counter-proposals.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                {stats.map(s => (
                    <div key={s.label} style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <s.icon size={18} color={s.color} />
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{s.label}</span>
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>
            <PriceRequestClient requests={requests} />
        </div>
    );
}
