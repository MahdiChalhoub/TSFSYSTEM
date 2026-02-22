import { Cloud, Database, HardDrive, FileText, FileSpreadsheet, Image, File } from 'lucide-react';
import React from 'react';

export const PROVIDER_OPTIONS = [
    { value: 'R2', label: 'Cloudflare R2', icon: Cloud, color: 'text-orange-500' },
    { value: 'S3', label: 'AWS S3', icon: Cloud, color: 'text-yellow-600' },
    { value: 'MINIO', label: 'MinIO', icon: Database, color: 'text-purple-500' },
    { value: 'LOCAL', label: 'Local Server', icon: HardDrive, color: 'text-gray-500' },
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
    ATTACHMENT: 'bg-blue-50 text-blue-600 border-blue-200',
    RECEIPT: 'bg-green-50 text-green-600 border-green-200',
    INVOICE: 'bg-amber-50 text-amber-600 border-amber-200',
    PROFORMA: 'bg-orange-50 text-orange-600 border-orange-200',
    SIGNED_ORDER: 'bg-purple-50 text-purple-600 border-purple-200',
    PURCHASE_ORDER: 'bg-sky-50 text-sky-600 border-sky-200',
    PURCHASE_RECEIPT: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    PURCHASE_DOC: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    TRANSFER_ORDER: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    TRANSFER: 'bg-violet-50 text-violet-600 border-violet-200',
    ADJUSTMENT_ORDER: 'bg-rose-50 text-rose-600 border-rose-200',
    ADJUSTMENT: 'bg-pink-50 text-pink-600 border-pink-200',
    RECEIPT_VOUCHER: 'bg-teal-50 text-teal-600 border-teal-200',
    PAYMENT_VOUCHER: 'bg-lime-50 text-lime-600 border-lime-200',
    EXPENSE: 'bg-red-50 text-red-600 border-red-200',
    EMPLOYEE_DOC: 'bg-rose-50 text-rose-600 border-rose-200',
    PRODUCT_IMAGE: 'bg-pink-50 text-pink-600 border-pink-200',
    PAYMENT_RECEIPT: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    LOGO: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    USER_ATTACHMENT: 'bg-slate-50 text-slate-600 border-slate-200',
    OTHER: 'bg-gray-50 text-gray-600 border-gray-200',
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
