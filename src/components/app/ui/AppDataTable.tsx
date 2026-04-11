'use client';
import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * AppDataTable — theme-aware table primitive.
 *
 * Guarantees visual consistency across ALL module list pages.
 * Finance ↔ Inventory ↔ Sales rows will always look identical.
 *
 * Features:
 *   - sortable column headers
 *   - loading skeleton rows
 *   - empty state with icon + message
 *   - row click handler
 *   - sticky header
 *   - theme-aware hover (--app-primary-light at 5% opacity)
 *
 * Usage:
 *   <AppDataTable
 *     columns={[
 *       { key: 'name', label: 'Name', sortable: true },
 *       { key: 'amount', label: 'Amount', align: 'right' },
 *       { key: 'status', label: 'Status' },
 *     ]}
 *     data={rows}
 *     onRowClick={(row) => router.push(`/detail/${row.id}`)}
 *     sortKey="name"
 *     sortDir="asc"
 *     onSort={(key) => handleSort(key)}
 *     loading={isLoading}
 *     emptyMessage="No records found"
 *     emptyIcon={<Package size={40} />}
 *   />
 */

export interface AppTableColumn<T> {
    key: keyof T | string;
    label: string;
    sortable?: boolean;
    align?: 'left' | 'center' | 'right';
    width?: string;
    render?: (row: T, index: number) => React.ReactNode;
}

interface AppDataTableProps<T extends Record<string, unknown>> {
    columns: AppTableColumn<T>[];
    data: T[];
    onRowClick?: (row: T) => void;
    sortKey?: string;
    sortDir?: 'asc' | 'desc';
    onSort?: (key: string) => void;
    loading?: boolean;
    loadingRowCount?: number;
    emptyMessage?: string;
    emptyIcon?: React.ReactNode;
    emptyAction?: React.ReactNode;
    rowKey?: keyof T;
    className?: string;
}

function LoadingRow({ colCount }: { colCount: number }) {
    return (
        <tr>
            {Array.from({ length: colCount }).map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <div
                        className="app-skeleton h-4 rounded"
                        style={{ width: i === 0 ? '60%' : i === colCount - 1 ? '40%' : '80%' }}
                    />
                </td>
            ))}
        </tr>
    );
}

export function AppDataTable<T extends Record<string, unknown>>({
    columns,
    data,
    onRowClick,
    sortKey,
    sortDir = 'asc',
    onSort,
    loading = false,
    loadingRowCount = 6,
    emptyMessage = 'No records found',
    emptyIcon,
    emptyAction,
    rowKey,
    className = '',
}: AppDataTableProps<T>) {
    return (
        <div
            className={`overflow-hidden ${className}`}
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                borderRadius: 'var(--app-radius)',
                boxShadow: 'var(--app-shadow-sm)',
            }}
        >
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    {/* Header */}
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}>
                            {columns.map((col) => {
                                const isSorted = sortKey === col.key;
                                const canSort = col.sortable && onSort;
                                return (
                                    <th
                                        key={String(col.key)}
                                        className="px-4 py-3 select-none"
                                        style={{
                                            width: col.width,
                                            textAlign: col.align ?? 'left',
                                            cursor: canSort ? 'pointer' : 'default',
                                            whiteSpace: 'nowrap',
                                            userSelect: 'none',
                                        }}
                                        onClick={() => canSort && onSort(String(col.key))}
                                    >
                                        <span
                                            className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest"
                                            style={{
                                                color: isSorted ? 'var(--app-primary)' : 'var(--app-text-muted)',
                                            }}
                                        >
                                            {col.label}
                                            {canSort && (
                                                <span className="flex flex-col opacity-50" style={{ lineHeight: 0 }}>
                                                    <ChevronUp
                                                        size={10}
                                                        style={{ marginBottom: -2, opacity: isSorted && sortDir === 'asc' ? 1 : 0.4 }}
                                                    />
                                                    <ChevronDown
                                                        size={10}
                                                        style={{ opacity: isSorted && sortDir === 'desc' ? 1 : 0.4 }}
                                                    />
                                                </span>
                                            )}
                                        </span>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    {/* Body */}
                    <tbody>
                        {loading
                            ? Array.from({ length: loadingRowCount }).map((_, i) => (
                                <LoadingRow key={i} colCount={columns.length} />
                            ))
                            : data.length === 0
                                ? (
                                    <tr>
                                        <td colSpan={columns.length}>
                                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                                {emptyIcon && (
                                                    <div style={{ color: 'var(--app-text-faint)' }}>
                                                        {emptyIcon}
                                                    </div>
                                                )}
                                                <p
                                                    className="text-sm font-semibold"
                                                    style={{ color: 'var(--app-text-muted)' }}
                                                >
                                                    {emptyMessage}
                                                </p>
                                                {emptyAction}
                                            </div>
                                        </td>
                                    </tr>
                                )
                                : data.map((row, rowIndex) => {
                                    const key = rowKey ? String(row[rowKey]) : rowIndex;
                                    return (
                                        <tr
                                            key={key}
                                            className="app-table-row animate-stagger"
                                            style={{
                                                cursor: onRowClick ? 'pointer' : 'default',
                                                '--i': rowIndex,
                                            } as React.CSSProperties}
                                            onClick={() => onRowClick?.(row)}
                                        >
                                            {columns.map((col) => (
                                                <td
                                                    key={String(col.key)}
                                                    className="px-4 py-3 text-sm"
                                                    style={{
                                                        textAlign: col.align ?? 'left',
                                                        color: 'var(--app-text)',
                                                        fontFamily: 'var(--app-font)',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {col.render
                                                        ? col.render(row, rowIndex)
                                                        : String(row[col.key as keyof T] ?? '—')}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
