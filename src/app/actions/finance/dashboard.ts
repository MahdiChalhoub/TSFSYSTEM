'use server'

import { erpFetch } from '@/lib/erp-api'
import { serializeDecimals } from '@/lib/utils/serialization'

export async function getFinancialDashboardStats(scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    try {
        const data = await erpFetch(`dashboard/financial_stats/?scope=${scope}`);
        return serializeDecimals(data);
    } catch (e) {
        console.error("Failed to fetch financial dashboard stats:", e);
        // Return empty structure to prevent UI crash
        return serializeDecimals({
            totalCash: 0,
            monthlyIncome: 0,
            monthlyExpense: 0,
            netProfit: 0,
            totalAR: 0,
            totalAP: 0,
            trends: [],
            recentEntries: [],
            inventoryStatus: {
                totalValue: 0,
                ledgerBalance: 0,
                discrepancy: 0,
                isMapped: false
            }
        });
    }
}

export async function getAdminDashboardStats() {
    try {
        const data = await erpFetch('dashboard/admin_stats/');
        return serializeDecimals(data);
    } catch (e) {
        console.warn("Failed to fetch dashboard stats from Django:", e);
        return serializeDecimals({
            totalSales: 0,
            activeOrders: 0,
            totalProducts: 0,
            totalCustomers: 0,
            latestSales: []
        });
    }
}

