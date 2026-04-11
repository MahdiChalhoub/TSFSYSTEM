/**
 * New Order Form — Types
 * ========================
 */

export interface OrderLine {
    id: string;
    productId: number;
    productName: string;
    barcode: string;
    unit: string;
    category: string;
    qtyRequired: number;
    qtyProposed: number;
    stockOnLocation: number;
    stockTotal: number;
    stockInTransit: number;
    purchaseCount: number;
    productStatus: string;
    statusDetail: string | null;
    dailySales: number;
    monthlyAverage: number;
    salesPeriodDays: number;
    financialScore: number;
    adjustmentScore: number;
    marginPct: number;
    unitCost: number;
    sellingPrice: number;
    bestSupplier: string;
    bestPrice: number;
    bestPricePeriodDays: number;
    isExpiryTracked: boolean;
    expiryInfo: { nearest_days: number; safety_tag: string; expiry_date: string } | null;
    safetyTag: 'SAFE' | 'CAUTION' | 'RISKY';
    availableSuppliers: { name: string; price?: number; last_date?: string }[];
    salesWindows: { start: string; end: string; qty: number }[];
    salesWindowSizeDays: number;
    trend: 'UP' | 'DOWN' | 'FLAT';
    actionQty: number;
}
