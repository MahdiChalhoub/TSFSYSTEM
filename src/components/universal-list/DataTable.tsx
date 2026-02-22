'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import type { ColumnDef, ActionDef } from './types';

interface DataTableProps<T = any> {
    columns: ColumnDef<T>[];
    visibleColumns: string[];
    data: T[];
    actions?: ActionDef<T>[];
    expandable?: boolean;
    renderExpanded?: (row: T) => React.ReactNode;
    selectable?: boolean;
    selectedRows: Set<string | number>;
    onToggleSelect: (key: string | number) => void;
    onToggleSelectAll: () => void;
    rowKey: (row: T) => string | number;
    sortColumn: string;
    sortDirection: 'asc' | 'desc';
    onSort: (column: string) => void;
    loading?: boolean;
}

export default function DataTable<T = any>({
    columns,
    visibleColumns,
    data,
    actions,
    expandable,
    renderExpanded,
    selectable,
    selectedRows,
    onToggleSelect,
    onToggleSelectAll,
    rowKey,
    sortColumn,
    sortDirection,
    onSort,
    loading,
}: DataTableProps<T>) {
    const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

    const activeColumns = useMemo(() => {
        if (visibleColumns.length === 0) {
            return columns.filter(c => c.defaultVisible !== false);
        }
        return visibleColumns
            .map(key => columns.find(c => c.key === key))
            .filter(Boolean) as ColumnDef<T>[];
    }, [columns, visibleColumns]);

    const toggleExpand = (key: string | number) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const allSelected = data.length > 0 && data.every(row => selectedRows.has(rowKey(row)));

    if (loading) {
        return (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="animate-pulse">
                    <div className="h-10 bg-gray-50 border-b" />
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex gap-4 px-4 py-3 border-b border-gray-50">
                            <div className="h-4 bg-gray-100 rounded w-24" />
                            <div className="h-4 bg-gray-100 rounded w-32" />
                            <div className="h-4 bg-gray-100 rounded w-16" />
                            <div className="h-4 bg-gray-100 rounded w-20" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-100">
                            {selectable && (
                                <th className="w-10 px-3 py-2.5">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={onToggleSelectAll}
                                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                                    />
                                </th>
                            )}
                            {expandable && <th className="w-8" />}
                            {activeColumns.map(col => (
                                <th
                                    key={col.key}
                                    className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap ${col.sortable ? 'cursor-pointer select-none hover:text-gray-700' : ''
                                        } text-${col.align || 'left'}`}
                                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                                    onClick={() => col.sortable && onSort(col.key)}
                                >
                                    <span className="flex items-center gap-1">
                                        {col.label}
                                        {col.sortable && sortColumn === col.key && (
                                            sortDirection === 'asc'
                                                ? <ChevronUp size={12} />
                                                : <ChevronDown size={12} />
                                        )}
                                    </span>
                                </th>
                            ))}
                            {actions && actions.length > 0 && (
                                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">
                                    Action
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {data.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={
                                        activeColumns.length +
                                        (selectable ? 1 : 0) +
                                        (expandable ? 1 : 0) +
                                        (actions?.length ? 1 : 0)
                                    }
                                    className="px-4 py-12 text-center text-gray-400"
                                >
                                    No data found
                                </td>
                            </tr>
                        ) : (
                            data.map((row, i) => {
                                const key = rowKey(row);
                                const isExpanded = expandedRows.has(key);
                                const isSelected = selectedRows.has(key);

                                return (
                                    <>
                                        <tr
                                            key={`row-${key}`}
                                            className={`transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'
                                                } ${isExpanded ? 'bg-gray-50/30' : ''}`}
                                        >
                                            {selectable && (
                                                <td className="w-10 px-3 py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => onToggleSelect(key)}
                                                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                                                    />
                                                </td>
                                            )}
                                            {expandable && (
                                                <td className="w-8 px-1">
                                                    <button
                                                        onClick={() => toggleExpand(key)}
                                                        className="p-1 rounded hover:bg-gray-100 transition-all"
                                                    >
                                                        <ChevronRight
                                                            size={14}
                                                            className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                        />
                                                    </button>
                                                </td>
                                            )}
                                            {activeColumns.map(col => (
                                                <td
                                                    key={col.key}
                                                    className={`px-3 py-2.5 text-${col.align || 'left'} whitespace-nowrap`}
                                                >
                                                    {col.render
                                                        ? col.render((row as any)[col.key], row, i)
                                                        : (row as any)[col.key] ?? '—'
                                                    }
                                                </td>
                                            ))}
                                            {actions && actions.length > 0 && (
                                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {actions
                                                            .filter(a => !a.show || a.show(row))
                                                            .map((action, ai) => {
                                                                const Icon = action.icon;
                                                                const variantClass =
                                                                    action.variant === 'danger'
                                                                        ? 'text-red-500 hover:bg-red-50'
                                                                        : action.variant === 'success'
                                                                            ? 'text-emerald-600 hover:bg-emerald-50'
                                                                            : action.variant === 'warning'
                                                                                ? 'text-amber-600 hover:bg-amber-50'
                                                                                : 'text-gray-500 hover:bg-gray-100';
                                                                return (
                                                                    <button
                                                                        key={ai}
                                                                        onClick={() => action.onClick(row)}
                                                                        title={action.label}
                                                                        className={`p-1.5 rounded-lg transition-all ${variantClass}`}
                                                                    >
                                                                        <Icon size={14} />
                                                                    </button>
                                                                );
                                                            })}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                        {/* Expanded Row */}
                                        {expandable && isExpanded && renderExpanded && (
                                            <tr key={`expanded-${key}`}>
                                                <td
                                                    colSpan={
                                                        activeColumns.length +
                                                        (selectable ? 1 : 0) +
                                                        1 +
                                                        (actions?.length ? 1 : 0)
                                                    }
                                                    className="px-4 py-3 bg-emerald-50/30 border-l-4 border-emerald-400"
                                                >
                                                    {renderExpanded(row)}
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
