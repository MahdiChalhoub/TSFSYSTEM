'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useListPreferences } from '@/hooks/useListPreferences';
import FilterBar from './FilterBar';
import DataTable from './DataTable';
import ListFooter from './ListFooter';
import type { UniversalListProps, ListParams } from './types';

/**
 * UniversalList — The standard list/table layout for the entire platform.
 *
 * Usage:
 * ```tsx
 * <UniversalList
 *   listKey="inventory.transfers"
 *   title="Stock Transfer"
 *   icon={Truck}
 *   accent="emerald"
 *   columns={columns}
 *   data={transfers}
 *   filters={filters}
 *   actions={actions}
 *   addButton={{ label: 'Add Transfer', onClick: ... }}
 *   expandable
 *   renderExpanded={row => <LineItemsTable lines={row.lines} />}
 *   onExport={handleExport}
 *   onParamsChange={handleParamsChange}
 * />
 * ```
 */
export default function UniversalList<T = any>({
    listKey,
    title,
    icon: Icon,
    accent = 'blue',
    columns,
    data,
    totalCount,
    filters = [],
    actions,
    addButton,
    expandable,
    renderExpanded,
    onExport,
    loading,
    onParamsChange,
    rowKey = (row: any) => row.id,
    selectable,
    onSelectionChange,
    bulkActions,
}: UniversalListProps<T>) {
    // ── Preferences ──
    const defaultCols = columns.filter(c => c.defaultVisible !== false).map(c => c.key);
    const { preferences, loaded, setVisibleColumns, setPageSize, setSort } = useListPreferences(listKey, defaultCols);

    // ── Local State ──
    const [search, setSearch] = useState('');
    const [filterValues, setFilterValues] = useState<Record<string, any>>({});
    const [page, setPage] = useState(1);
    const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());

    const visibleColumns = preferences.visible_columns.length > 0
        ? preferences.visible_columns
        : defaultCols;

    const sortColumn = preferences.sort_column;
    const sortDirection = preferences.sort_direction;
    const pageSize = preferences.page_size;

    // ── Notify parent of param changes ──
    const notifyParams = useCallback(() => {
        onParamsChange?.({
            search,
            filters: filterValues,
            page,
            pageSize,
            sortColumn,
            sortDirection,
        });
    }, [search, filterValues, page, pageSize, sortColumn, sortDirection, onParamsChange]);

    useEffect(() => {
        if (loaded) notifyParams();
    }, [search, filterValues, page, pageSize, sortColumn, sortDirection, loaded]);

    // ── Handlers ──
    const handleSearchChange = (val: string) => {
        setSearch(val);
        setPage(1);
    };

    const handleFilterChange = (key: string, value: any) => {
        setFilterValues(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const handleFilterReset = () => {
        setFilterValues({});
        setSearch('');
        setPage(1);
    };

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSort(column, sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSort(column, 'asc');
        }
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setPage(1);
    };

    const handleColumnsChange = (cols: string[]) => {
        setVisibleColumns(cols);
    };

    const handleToggleSelect = (key: string | number) => {
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleToggleSelectAll = () => {
        if (data.every(row => selectedRows.has(rowKey(row)))) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(data.map(row => rowKey(row))));
        }
    };

    // Report selection changes
    useEffect(() => {
        if (onSelectionChange) {
            const selected = data.filter(row => selectedRows.has(rowKey(row)));
            onSelectionChange(selected);
        }
    }, [selectedRows]);

    const count = totalCount ?? data.length;

    // Accent color mapping
    const accentBg = `bg-${accent}-600`;
    const accentText = `text-${accent}-600`;

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    {Icon && (
                        <div className={`p-2 ${accentBg} rounded-lg text-white`}>
                            <Icon size={18} />
                        </div>
                    )}
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h1>
                </div>
                <div className="flex items-center gap-3">
                    {onExport && (
                        <button
                            onClick={onExport}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
                        >
                            <Download size={14} />
                            Export
                        </button>
                    )}
                    {addButton && (
                        <button
                            onClick={addButton.onClick}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold text-white ${accentBg} rounded-lg hover:opacity-90 transition-all shadow-sm`}
                        >
                            + {addButton.label}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Bulk Actions ── */}
            {selectable && selectedRows.size > 0 && bulkActions && bulkActions.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                    <span className="text-xs font-semibold text-blue-700">
                        {selectedRows.size} selected
                    </span>
                    {bulkActions.map((ba, i) => (
                        <button
                            key={i}
                            onClick={() => ba.onClick(data.filter(row => selectedRows.has(rowKey(row))))}
                            className="px-3 py-1 text-xs font-semibold border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-all"
                        >
                            {ba.label}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Filters ── */}
            {filters.length > 0 && (
                <FilterBar
                    filters={filters}
                    values={filterValues}
                    search={search}
                    onSearchChange={handleSearchChange}
                    onFilterChange={handleFilterChange}
                    onReset={handleFilterReset}
                />
            )}

            {/* ── Table ── */}
            <DataTable
                columns={columns}
                visibleColumns={visibleColumns}
                data={data}
                actions={actions}
                expandable={expandable}
                renderExpanded={renderExpanded}
                selectable={selectable}
                selectedRows={selectedRows}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                rowKey={rowKey}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
                loading={loading}
            />

            {/* ── Footer ── */}
            <ListFooter
                totalCount={count}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                columns={columns}
                visibleColumns={visibleColumns}
                onColumnsChange={handleColumnsChange}
            />
        </div>
    );
}
