'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import ColumnSelector from './ColumnSelector';
import type { ColumnDef } from './types';

interface ListFooterProps {
    totalCount: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    columns: ColumnDef[];
    visibleColumns: string[];
    onColumnsChange: (columns: string[]) => void;
    totalLabel?: string;
    totalValue?: string;
}

export default function ListFooter({
    totalCount,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    columns,
    visibleColumns,
    onColumnsChange,
    totalLabel,
    totalValue,
}: ListFooterProps) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalCount);

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 px-1 py-2">
            {/* Left: Count + Total */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">
                    {totalLabel || 'Items'} ({totalCount})
                </span>
                {totalValue && (
                    <span>
                        Total Value: <span className="font-semibold text-gray-700">{totalValue}</span>
                    </span>
                )}
            </div>

            {/* Right: Pagination + Page Size + Column Picker */}
            <div className="flex items-center gap-3">
                {/* Pagination */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <span className="px-2 text-xs font-semibold text-gray-600">
                        {startItem}–{endItem} of {totalCount}
                    </span>
                    <button
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>

                {/* Page Size */}
                <select
                    value={pageSize}
                    onChange={e => onPageSizeChange(Number(e.target.value))}
                    className="px-2 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-600 hover:border-gray-300 cursor-pointer"
                >
                    {[10, 25, 50, 100].map(size => (
                        <option key={size} value={size}>
                            {size} / page
                        </option>
                    ))}
                </select>

                {/* Column Picker */}
                <ColumnSelector
                    columns={columns}
                    visibleColumns={visibleColumns}
                    onChange={onColumnsChange}
                />
            </div>
        </div>
    );
}
