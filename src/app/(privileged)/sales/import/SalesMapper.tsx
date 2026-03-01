'use client';

import React, { useState, useCallback } from 'react';
import type { ImportResult } from '@/types/erp';
import {
    Upload, FileText, CheckCircle2, AlertCircle,
    ArrowRight, Settings2, Database, Table as TableIcon,
    Loader2, Search, Warehouse as WarehouseIcon, CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { importSalesAction } from '@/app/actions/sales';

interface SalesMapperProps {
    warehouses: Record<string, any>[];
    accounts: Record<string, any>[];
}

export function SalesMapper({ warehouses, accounts }: SalesMapperProps) {
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState({
        date: '',
        product_sku: '',
        quantity: '',
        unit_price: '',
        payment_account_id: ''
    });
    const [warehouseId, setWarehouseId] = useState("");
    const [scope, setScope] = useState("INTERNAL");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<ImportResult | null>(null);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            Papa.parse(selectedFile, {
                header: false,
                preview: 1,
                complete: (results) => {
                    const firstRow = results.data[0] as string[];
                    setHeaders(firstRow || []);
                    // Auto-map if headers match exactly
                    const newMapping = { ...mapping };
                    firstRow.forEach(h => {
                        const hl = h.toLowerCase();
                        if (hl.includes('date')) newMapping.date = h;
                        if (hl.includes('sku') || hl.includes('product')) newMapping.product_sku = h;
                        if (hl.includes('qty') || hl.includes('quantity')) newMapping.quantity = h;
                        if (hl.includes('price') || hl.includes('unit')) newMapping.unit_price = h;
                    });
                    setMapping(newMapping);
                }
            });
        }
    };

    const handleImport = async () => {
        if (!file || !warehouseId || !mapping.payment_account_id) {
            toast.error("Please select a file, warehouse, and payment account.");
            return;
        }

        setLoading(true);
        setResults(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('mapping', JSON.stringify(mapping));
        formData.append('warehouse_id', warehouseId);
        formData.append('scope', scope);

        try {
            const res = await importSalesAction(formData);
            setResults(res);
            if (res.error_count === 0) {
                toast.success(`Successfully imported ${res.success_count} sales!`);
            } else {
                toast.warning(`Imported ${res.success_count} with ${res.error_count} errors.`);
            }
        } catch (error: unknown) {
            toast.error((error instanceof Error ? error.message : String(error)) || "Import failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Step 1: Upload */}
            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                        <Upload size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Step 1: Upload Source</h2>
                        <p className="text-xs text-gray-400 font-medium tracking-tight">Select your CSV data file</p>
                    </div>
                </div>

                <div className="relative group">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={onFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`p-12 border-2 border-dashed rounded-[2rem] transition-all flex flex-col items-center justify-center gap-4 ${file ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/50 group-hover:border-blue-300 group-hover:bg-blue-50/30'}`}>
                        {file ? (
                            <>
                                <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
                                    <FileText size={40} />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-black text-gray-900 tracking-tight">{file.name}</p>
                                    <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">File Loaded Successfully</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl">
                                    <TableIcon size={40} />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-black text-gray-900 tracking-tight">Drop your CSV here</p>
                                    <p className="text-xs text-gray-400 font-medium">Click to browse or drag and drop</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Step 2: Mapping & Config */}
            {file && (
                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm animate-in slide-in-from-bottom-8 duration-500">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                            <Settings2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Step 2: Import Settings</h2>
                            <p className="text-xs text-gray-400 font-medium tracking-tight">Bridge columns and set destination parameters</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        {/* Column Mapping */}
                        <div className="space-y-6">
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                <Database size={14} /> Column Mapping
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {Object.entries(mapping).map(([key, value]) => (
                                    key !== 'payment_account_id' && (
                                        <div key={key} className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-tighter pl-1">
                                                {key.replace('_', ' ')}
                                            </Label>
                                            <Select
                                                value={mapping[key as keyof typeof mapping]}
                                                onValueChange={(val) => setMapping(prev => ({ ...prev, [key]: val }))}
                                            >
                                                <SelectTrigger className="h-12 rounded-xl border-gray-100 bg-gray-50/50">
                                                    <SelectValue placeholder={`Select ${key} column`} />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-gray-100">
                                                    {headers.map(h => (
                                                        <SelectItem key={h} value={h}>{h}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>

                        {/* Destination Config */}
                        <div className="space-y-6">
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                <ArrowRight size={14} /> Destination Parameters
                            </h3>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-gray-500 tracking-tighter pl-1 flex items-center gap-2">
                                        <WarehouseIcon size={12} /> Target Warehouse
                                    </Label>
                                    <Select value={warehouseId} onValueChange={setWarehouseId}>
                                        <SelectTrigger className="h-12 rounded-xl border-gray-100 bg-gray-50/50">
                                            <SelectValue placeholder="Select Warehouse" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-gray-100">
                                            {warehouses.map(w => (
                                                <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-gray-500 tracking-tighter pl-1 flex items-center gap-2">
                                        <CreditCard size={12} /> Payment Account (Ledger)
                                    </Label>
                                    <Select
                                        value={mapping.payment_account_id}
                                        onValueChange={(val) => setMapping(prev => ({ ...prev, payment_account_id: val }))}
                                    >
                                        <SelectTrigger className="h-12 rounded-xl border-gray-100 bg-gray-50/50">
                                            <SelectValue placeholder="Select Account" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-gray-100 max-h-[300px]">
                                            {accounts.map((a: Record<string, any>) => (
                                                <SelectItem key={a.id} value={a.id.toString()}>
                                                    <div className="flex flex-col items-start leading-none py-1">
                                                        <span className="font-bold text-gray-900">{a.name}</span>
                                                        <span className="text-[9px] font-mono text-gray-400">{a.code}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-gray-500 tracking-tighter pl-1">Accounting Scope</Label>
                                    <div className="flex gap-2">
                                        {['INTERNAL', 'OFFICIAL'].map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setScope(s)}
                                                className={`flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${scope === s ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6">
                                <Button
                                    onClick={handleImport}
                                    disabled={loading}
                                    className="w-full h-16 bg-slate-900 hover:bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-slate-900/40 transition-all flex items-center gap-3"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
                                    {loading ? "Processing..." : "Start Import"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Results */}
            {results && (
                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm animate-in zoom-in-95 duration-500">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                                <CheckCircle2 size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Sync Results</h2>
                                <p className="text-xs text-gray-400 font-medium tracking-tight">Import results</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="text-center">
                                <p className="text-2xl font-black text-emerald-600 tracking-tighter">{results.success_count}</p>
                                <p className="text-[9px] font-black uppercase text-emerald-400">Success</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-black text-red-600 tracking-tighter">{results.error_count}</p>
                                <p className="text-[9px] font-black uppercase text-red-400">Errors</p>
                            </div>
                        </div>
                    </div>

                    {results.errors.length > 0 && (
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-200">
                            <h3 className="text-xs font-black uppercase text-red-500 tracking-tighter">Error Diagnostic Log</h3>
                            <div className="space-y-2">
                                {results.errors.map((err: Record<string, any>, i: number) => (
                                    <div key={i} className="p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3 items-start">
                                        <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-[10px] font-black text-red-800 uppercase tracking-widest">Row {err.row}</p>
                                            <p className="text-xs text-red-600 font-medium leading-tight mt-1">{err.error}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
