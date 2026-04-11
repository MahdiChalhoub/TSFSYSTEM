'use client';

import { useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { autoReplenish } from '@/app/actions/purchases/purchase-orders';
import { toast } from 'sonner';

export function AutoReplenishButton() {
    const [loading, setLoading] = useState(false);

    async function handleAutoReplenish() {
        setLoading(true);
        toast.loading("Scanning products for Min/Max replenishment...", { id: 'replenish' });
        try {
            const res = await autoReplenish();
            if (res.error) throw new Error(res.error);
            toast.success(res.message || "Replenishment sweep completed!", { id: 'replenish' });
        } catch (error: any) {
            toast.error(error.message || "Failed to run automated engine", { id: 'replenish' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={handleAutoReplenish}
            disabled={loading}
            title="Scan inventory and auto-draft POs for items below minimum stock"
            className="flex items-center gap-2 px-5 h-11 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-4 focus:ring-amber-500/30 disabled:opacity-50"
            style={{
                background: 'var(--app-warning)',
                color: 'var(--app-background)',
                boxShadow: '0 4px 14px var(--app-warning-glow)'
            }}
        >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            {loading ? "Scanning..." : "Auto-Replenish"}
        </button>
    );
}
