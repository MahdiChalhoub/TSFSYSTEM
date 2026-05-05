import { Cloud, Database, HardDrive, FileText, FileSpreadsheet, Image, File } from 'lucide-react';
import React from 'react';

export const PROVIDER_OPTIONS = [
    { value: 'R2', label: 'Cloudflare R2', icon: Cloud, color: 'text-app-warning' },
    { value: 'S3', label: 'AWS S3', icon: Cloud, color: 'text-app-warning' },
    { value: 'MINIO', label: 'MinIO', icon: Database, color: 'text-purple-500' },
    { value: 'LOCAL', label: 'Local Server', icon: HardDrive, color: 'text-app-muted-foreground' },
];

export const CATEGORY_OPTIONS = [
    { value: '', label: 'All Categories' },
    { value: 'ATTACHMENT', label: 'Attachments' },
    { value: 'RECEIPT', label: 'Receipts' },
    { value: 'INVOICE', label: 'Invoices' },
    { value: 'PROFORMA', label: 'Proformas' },
    { value: 'SIGNED_ORDER', label: 'Signed Orders' },
    { value: 'PURCHASE_ORDER', label: 'Purchase Orders' },
    { value: 'PURCHASE_RECEIPT', label: 'Purchase Receipts' },
    { value: 'PURCHASE_DOC', label: 'Purchase Docs' },
    { value: 'TRANSFER_ORDER', label: 'Transfer Orders' },
    { value: 'TRANSFER', label: 'Transfers' },
    { value: 'ADJUSTMENT_ORDER', label: 'Adjustment Orders' },
    { value: 'ADJUSTMENT', label: 'Adjustments' },
    { value: 'RECEIPT_VOUCHER', label: 'Receipt Vouchers' },
    { value: 'PAYMENT_VOUCHER', label: 'Payment Vouchers' },
    { value: 'EXPENSE', label: 'Expenses' },
    { value: 'EMPLOYEE_DOC', label: 'Employee Docs' },
    { value: 'PRODUCT_IMAGE', label: 'Product Images' },
    { value: 'PAYMENT_RECEIPT', label: 'Payment Receipts' },
    { value: 'LOGO', label: 'Logos' },
    { value: 'USER_ATTACHMENT', label: 'User Attachments' },
    { value: 'OTHER', label: 'Other' },
];

export const CATEGORY_COLORS: Record<string, string> = {
    ATTACHMENT: 'bg-app-info-soft text-app-info border-app-info',
    RECEIPT: 'bg-app-success-soft text-app-success border-app-success',
    INVOICE: 'bg-app-warning-soft text-app-warning border-app-warning',
    PROFORMA: 'bg-app-warning-soft text-app-warning border-app-warning',
    SIGNED_ORDER: 'bg-purple-50 text-purple-600 border-purple-200',
    PURCHASE_ORDER: 'bg-app-info-soft text-app-info border-app-info',
    PURCHASE_RECEIPT: 'bg-app-success-soft text-app-success border-app-success',
    PURCHASE_DOC: 'bg-app-info-soft text-app-info border-app-info',
    TRANSFER_ORDER: 'bg-app-info-soft text-app-info border-app-info',
    TRANSFER: 'bg-violet-50 text-violet-600 border-violet-200',
    ADJUSTMENT_ORDER: 'bg-app-error-soft text-app-error border-app-error',
    ADJUSTMENT: 'bg-app-error-soft text-app-error border-app-error',
    RECEIPT_VOUCHER: 'bg-app-success-soft text-app-success border-app-success',
    PAYMENT_VOUCHER: 'bg-app-success-soft text-app-success border-app-success',
    EXPENSE: 'bg-app-error-soft text-app-error border-app-error',
    EMPLOYEE_DOC: 'bg-app-error-soft text-app-error border-app-error',
    PRODUCT_IMAGE: 'bg-app-error-soft text-app-error border-app-error',
    PAYMENT_RECEIPT: 'bg-app-success-soft text-app-success border-app-success',
    LOGO: 'bg-app-info-soft text-app-info border-app-info',
    USER_ATTACHMENT: 'bg-app-bg text-app-muted-foreground border-app-border',
    OTHER: 'bg-app-bg text-app-muted-foreground border-app-border',
};

export function getFileIcon(mime: string) {
    if (mime?.startsWith('image/')) return Image;
    if (mime?.includes('spreadsheet') || mime?.includes('excel') || mime?.includes('csv')) return FileSpreadsheet;
    if (mime?.includes('pdf') || mime?.includes('document') || mime?.includes('word')) return FileText;
    return File;
}

export function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
