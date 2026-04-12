'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Settings2,
    Filter,
    Search,
    ChevronDown,
    ChevronUp,
    MoreHorizontal,
    Eye,
    EyeOff,
    RotateCcw,
    Download,
    Bookmark,
    Save,
    Trash,
    Star
} from 'lucide-react';
import { getSavedViews, createSavedView, updateSavedView, deleteSavedView, UDLESavedView } from "@/app/actions/udle";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface FieldMeta {
    name: string;
    label: string;
    type: 'string' | 'number' | 'decimal' | 'boolean' | 'datetime' | 'date' | 'relation' | 'select';
    required: boolean;
    sortable: boolean;
    filterable: boolean;
    choices?: { value: string | number; label: string }[];
}

interface UDLEMeta {
    model: string;
    verbose_name: string;
    verbose_name_plural: string;
    fields: FieldMeta[];
    default_columns: string[];
}

interface UniversalDataTableProps {
    endpoint: string;
    fetcher: (params: string) => Promise<any>;
    metaFetcher: () => Promise<UDLEMeta>;
    onRowClick?: (row: Record<string, any>) => void;
    actions?: (row: Record<string, any>) => React.ReactNode;
}

export function UniversalDataTable({
    endpoint,
    fetcher,
    metaFetcher,
    onRowClick,
    actions
}: UniversalDataTableProps) {
    const [meta, setMeta] = useState<UDLEMeta | null>(null);
    const [data, setData] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);
    const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [search, setSearch] = useState("");
    const [sorting, setSorting] = useState<{ field: string, dir: 'asc' | 'desc' } | null>(null);
    const [savedViews, setSavedViews] = useState<UDLESavedView[]>([]);
    const [currentViewId, setCurrentViewId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Initial Load: Metadata & Saved Views
    useEffect(() => {
        async function loadMeta() {
            try {
                const [m, views] = await Promise.all([
                    metaFetcher(),
                    getSavedViews(endpoint.split('/').filter(Boolean).pop() || "")
                ]);

                setMeta(m);
                setSavedViews(views);

                // Apply default view if exists
                const defaultView = views.find((v: Record<string, any>) => v.is_default);
                if (defaultView) {
                    applyView(defaultView);
                } else {
                    setVisibleColumns(m.default_columns);
                }
            } catch (e) {
                toast.error("Failed to load list metadata or views");
            }
        }
        loadMeta();
    }, [metaFetcher, endpoint]);

    const applyView = (view: UDLESavedView) => {
        setCurrentViewId(view.id);
        if (view.config.columns) setVisibleColumns(view.config.columns);
        if (view.config.filters) setFilters(view.config.filters);
        if (view.config.sorting) setSorting(view.config.sorting);
    };

    const handleSaveView = async (name: string, isDefault = false) => {
        if (!meta) return;
        setIsSaving(true);
        try {
            const config = {
                columns: visibleColumns,
                filters,
                sorting
            };
            const res = await createSavedView({
                model_name: meta.model,
                name,
                config,
                is_default: isDefault
            });
            setSavedViews(prev => [...prev, res]);
            setCurrentViewId(res.id);
            toast.success("View saved successfully");
        } catch (e) {
            toast.error("Failed to save view");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateCurrentView = async () => {
        if (!currentViewId) return;
        setIsSaving(true);
        try {
            const config = {
                columns: visibleColumns,
                filters,
                sorting
            };
            await updateSavedView(currentViewId, { config });
            setSavedViews(prev => prev.map(v => v.id === currentViewId ? { ...v, config } : v));
            toast.success("View configuration updated");
        } catch (e) {
            toast.error("Failed to update view");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSetDefaultView = async (id: string) => {
        try {
            await updateSavedView(id, { is_default: true });
            setSavedViews(prev => prev.map(v => ({ ...v, is_default: v.id === id })));
            toast.success("Default view updated");
        } catch (e) {
            toast.error("Failed to set default view");
        }
    };

    const handleDeleteView = async (id: string) => {
        try {
            await deleteSavedView(id);
            setSavedViews(prev => prev.filter(v => v.id !== id));
            if (currentViewId === id) setCurrentViewId(null);
            toast.success("View deleted");
        } catch (e) {
            toast.error("Failed to delete view");
        }
    };

    // Data Fetching
    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (sorting) params.append('ordering', `${sorting.dir === 'desc' ? '-' : ''}${sorting.field}`);

            Object.entries(filters).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== "") {
                    params.append(k, v);
                }
            });

            const res = await fetcher(params.toString());
            setData(Array.isArray(res) ? res : (res.results || []));
        } catch (e) {
            toast.error("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (meta) loadData();
    }, [meta, search, sorting, filters]);

    const toggleColumn = (name: string) => {
        setVisibleColumns(prev =>
            prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
        );
    };

    const renderCell = (row: Record<string, any>, field: FieldMeta) => {
        const val = row[field.name];
        if (val === null || val === undefined) return <span className="text-gray-300">-</span>;

        switch (field.type) {
            case 'boolean':
                return <Badge variant={val ? 'default' : 'secondary'}>{val ? 'Yes' : 'No'}</Badge>;
            case 'datetime':
                return new Date(val).toLocaleString();
            case 'date':
                return new Date(val).toLocaleDateString();
            case 'decimal':
            case 'number':
                return val.toLocaleString();
            case 'relation':
                return typeof val === 'object' ? (val.name || val.code || JSON.stringify(val)) : val;
            default:
                if (field.choices) {
                    return field.choices.find(c => c.value === val)?.label || val;
                }
                return String(val);
        }
    };

    if (!meta) return <div className="h-64 flex items-center justify-center">Initializing Universal Engine...</div>;

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder={`Search ${meta.verbose_name_plural}...`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-11 rounded-2xl border-gray-100 focus:ring-emerald-500/10"
                        />
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-11 rounded-2xl gap-2 border-gray-100">
                                <Filter className="h-4 w-4" />
                                Filters
                                {Object.keys(filters).length > 0 && (
                                    <Badge className="ml-1 px-1.5 h-5 min-w-[20px] bg-emerald-500">{Object.keys(filters).length}</Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-6 rounded-[2rem] shadow-2xl border-gray-100">
                            <div className="space-y-4">
                                <h3 className="font-black uppercase tracking-tighter text-gray-900">Advanced Filters</h3>
                                <div className="space-y-4">
                                    {meta.fields.filter(f => f.filterable).slice(0, 5).map(field => (
                                        <div key={field.name} className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{field.label}</label>
                                            {field.choices ? (
                                                <select
                                                    className="w-full h-10 px-3 rounded-xl border border-gray-100 bg-slate-50 text-xs"
                                                    value={filters[field.name] || ""}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, [field.name]: e.target.value }))}
                                                >
                                                    <option value="">All</option>
                                                    {field.choices.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                                </select>
                                            ) : (
                                                <Input
                                                    placeholder="Filter value..."
                                                    value={filters[field.name] || ""}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, [field.name]: e.target.value }))}
                                                    className="h-10 rounded-xl border-gray-100 text-xs"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <Button
                                    variant="ghost"
                                    className="w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50"
                                    onClick={() => setFilters({})}
                                >
                                    Clear all filters
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-11 rounded-2xl gap-2 border-gray-100">
                                <Bookmark className="h-4 w-4" />
                                Views
                                {currentViewId && <Badge variant="secondary" className="bg-slate-100 text-slate-600 scale-90">Active</Badge>}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 p-2 rounded-2xl shadow-xl border-gray-100">
                            <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-gray-400 px-3 py-2">Saved Layouts</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {savedViews.length === 0 && (
                                <div className="px-3 py-4 text-center text-xs text-gray-400">No saved views yet</div>
                            )}
                            {savedViews.map(view => (
                                <DropdownMenuItem key={view.id} className="flex items-center justify-between group rounded-xl">
                                    <div className="flex-1 cursor-pointer" onClick={() => applyView(view)}>
                                        <span className={currentViewId === view.id ? "font-bold text-emerald-600" : ""}>{view.name}</span>
                                        {view.is_default && <Badge className="ml-2 scale-75 bg-amber-50 text-amber-600 border-amber-100">Default</Badge>}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            className={`h-6 w-6 p-0 ${view.is_default ? 'text-amber-500' : 'text-gray-300'}`}
                                            onClick={(e) => { e.stopPropagation(); handleSetDefaultView(view.id); }}
                                        >
                                            <Star className={`h-3 w-3 ${view.is_default ? 'fill-current' : ''}`} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="h-6 w-6 p-0 text-red-400 hover:text-red-500 hover:bg-red-50"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteView(view.id); }}
                                        >
                                            <Trash className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <div className="p-2 space-y-2">
                                {currentViewId && (
                                    <Button
                                        variant="outline"
                                        className="w-full h-8 text-[9px] font-black uppercase tracking-widest gap-2 rounded-lg border-emerald-100 text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                                        onClick={handleUpdateCurrentView}
                                        disabled={isSaving}
                                    >
                                        <Save className="h-3 w-3" />
                                        Update Current
                                    </Button>
                                )}
                                <Input
                                    id="new-view-name"
                                    placeholder="New view name..."
                                    className="h-9 text-xs rounded-xl border-gray-100"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSaveView(e.currentTarget.value);
                                            e.currentTarget.value = "";
                                        }
                                    }}
                                />
                                <Button
                                    variant="outline"
                                    className="w-full h-9 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl border-gray-100 bg-slate-50 hover:bg-slate-100"
                                    disabled={isSaving}
                                    onClick={() => {
                                        const input = document.getElementById('new-view-name') as HTMLInputElement;
                                        if (input.value) {
                                            handleSaveView(input.value);
                                            input.value = "";
                                        }
                                    }}
                                >
                                    <Save className="h-3.5 w-3.5" />
                                    Save as New View
                                </Button>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-11 rounded-2xl gap-2 border-gray-100">
                                <Settings2 className="h-4 w-4" />
                                Columns
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 p-2 rounded-2xl shadow-xl border-gray-100">
                            <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-gray-400 px-3 py-2">Visibility</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <div className="max-h-64 overflow-auto">
                                {meta.fields.map(field => (
                                    <DropdownMenuCheckboxItem
                                        key={field.name}
                                        checked={visibleColumns.includes(field.name)}
                                        onCheckedChange={() => toggleColumn(field.name)}
                                        className="rounded-lg text-xs"
                                    >
                                        {field.label}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="outline" className="h-11 w-11 p-0 rounded-2xl border-gray-100" onClick={loadData}>
                        <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent border-gray-100">
                            {visibleColumns.map(col => {
                                const field = meta.fields.find(f => f.name === col);
                                return (
                                    <TableHead
                                        key={col}
                                        className="h-14 text-[10px] font-black uppercase tracking-widest text-gray-500 cursor-pointer hover:text-gray-900 transition-colors"
                                        onClick={() => setSorting(prev => ({
                                            field: col,
                                            dir: prev?.field === col && prev.dir === 'asc' ? 'desc' : 'asc'
                                        }))}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {field?.label}
                                            {sorting?.field === col ? (
                                                sorting.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            ) : (
                                                <MoreHorizontal className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                                            )}
                                        </div>
                                    </TableHead>
                                );
                            })}
                            {actions && <TableHead className="w-10"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && data.length === 0 ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i} className="animate-pulse">
                                    {visibleColumns.map(c => (
                                        <TableCell key={c}><div className="h-4 bg-slate-100 rounded-lg w-full"></div></TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={visibleColumns.length + (actions ? 1 : 0)} className="h-64 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <EyeOff className="h-8 w-8 text-slate-200" />
                                        <p className="text-sm font-medium text-slate-400">No records found matching your criteria</p>
                                        <Button variant="link" className="text-xs text-emerald-600 font-bold" onClick={() => { setFilters({}); setSearch(""); }}>Reset all filters</Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((row, idx) => (
                                <TableRow
                                    key={(row.id as string | number) || idx}
                                    onClick={() => onRowClick?.(row)}
                                    className={`group cursor-pointer border-gray-50 ${onRowClick ? 'hover:bg-slate-50/80 transition-all' : ''}`}
                                >
                                    {visibleColumns.map(col => {
                                        const field = meta.fields.find(f => f.name === col);
                                        return (
                                            <TableCell key={col} className="text-xs font-medium text-gray-600 py-4">
                                                {field ? renderCell(row, field) : '-'}
                                            </TableCell>
                                        );
                                    })}
                                    {actions && (
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            {actions(row)}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Footer (Placeholder for now) */}
            <div className="flex items-center justify-between px-6 py-4 bg-white/50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400">
                <span>Showing {data.length} results</span>
                <div className="flex items-center gap-4">
                    <Button variant="ghost" disabled className="h-8 rounded-lg">Prev</Button>
                    <div className="flex items-center gap-1.5">
                        <span className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center">1</span>
                    </div>
                    <Button variant="ghost" disabled className="h-8 rounded-lg">Next</Button>
                </div>
            </div>
        </div>
    );
}
