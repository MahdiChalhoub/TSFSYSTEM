'use client';

/**
 * CsvImportDialog — imports categories from a CSV file.
 *
 * Expected columns (headers case-insensitive):
 *   name (required) · code · short_name · barcode_prefix · parent_code
 *
 * parent_code is a lookup into existing categories by `code` or `name`.
 * Unknown parents are treated as roots. Each row fires a POST to
 * /api/inventory/categories/; we surface errors per row without aborting.
 *
 * Keeps the backend dependency-free — no new endpoint needed today.
 */

import { useState, useRef } from 'react';
import { X, Upload, FileText, Loader2, Check, AlertTriangle } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import type { CategoryNode } from './types';

interface Props {
    allCategories: CategoryNode[];
    onClose: () => void;
    onDone: () => void;
}

type Row = { name: string; code?: string; short_name?: string; barcode_prefix?: string; parent_code?: string };
type Result = { name: string; ok: boolean; error?: string };

function parseCSV(text: string): Row[] {
    // Tolerant of Excel BOM + CR/LF mixes. One-pass splitter — not full
    // RFC 4180 (no quoted commas), but enough for master-data imports.
    const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const lines = clean.split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: Row[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',').map(c => c.trim());
        const obj: any = {};
        headers.forEach((h, idx) => { obj[h] = cells[idx] || ''; });
        if (obj.name) rows.push(obj);
    }
    return rows;
}

export function CsvImportDialog({ allCategories, onClose, onDone }: Props) {
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState<Result[]>([]);

    const onFile = async (f: File) => {
        const text = await f.text();
        setRows(parseCSV(text));
        setResults([]);
    };

    const run = async () => {
        setImporting(true);
        const byCode = new Map<string, CategoryNode>();
        allCategories.forEach(c => {
            if (c.code) byCode.set(c.code.toLowerCase(), c);
            byCode.set(c.name.toLowerCase(), c);
        });
        const out: Result[] = [];
        for (const r of rows) {
            try {
                const parent = r.parent_code ? byCode.get(r.parent_code.toLowerCase()) : null;
                await erpFetch('inventory/categories/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: r.name,
                        code: r.code || null,
                        short_name: r.short_name || null,
                        barcode_prefix: r.barcode_prefix || '',
                        parent: parent?.id ?? null,
                    }),
                });
                out.push({ name: r.name, ok: true });
            } catch (e: any) {
                out.push({ name: r.name, ok: false, error: e?.message || 'failed' });
            }
        }
        setResults(out);
        setImporting(false);
        const ok = out.filter(o => o.ok).length;
        if (ok === out.length) toast.success(`${ok} categor${ok === 1 ? 'y' : 'ies'} imported`);
        else toast.warning(`${ok} imported, ${out.length - ok} failed`);
        if (ok > 0) onDone();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
             onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-xl max-h-[88vh] rounded-2xl flex flex-col overflow-hidden"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
                <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
                     style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                             style={{ background: 'var(--app-primary)', color: 'white' }}>
                            <Upload size={15} />
                        </div>
                        <div>
                            <h3 className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>Import categories</h3>
                            <p className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                From CSV
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="p-1.5 rounded-lg transition-all hover:bg-app-border/30"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div className="p-3 rounded-xl text-tp-xs"
                         style={{ background: 'color-mix(in srgb, var(--app-info) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 25%, transparent)', color: 'var(--app-foreground)' }}>
                        Columns (case-insensitive): <code className="font-mono font-bold">name</code> (required), <code className="font-mono font-bold">code</code>, <code className="font-mono font-bold">short_name</code>, <code className="font-mono font-bold">barcode_prefix</code>, <code className="font-mono font-bold">parent_code</code> (lookup by existing code or name).
                    </div>

                    {/* Drop zone */}
                    <div onClick={() => fileRef.current?.click()}
                         onDragOver={e => e.preventDefault()}
                         onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
                         className="p-6 rounded-2xl text-center cursor-pointer transition-all"
                         style={{ border: '2px dashed var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 4%, transparent)' }}>
                        <FileText size={24} className="mx-auto mb-2" style={{ color: 'var(--app-primary)' }} />
                        <p className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>
                            {rows.length > 0 ? `${rows.length} row${rows.length === 1 ? '' : 's'} loaded` : 'Drop a .csv file or click to browse'}
                        </p>
                        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                               onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
                    </div>

                    {rows.length > 0 && results.length === 0 && (
                        <div className="rounded-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar"
                             style={{ border: '1px solid var(--app-border)' }}>
                            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 text-tp-xxs font-bold uppercase tracking-widest"
                                 style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>
                                <span>Name</span><span>Code</span><span>Short</span><span>Prefix</span><span>Parent</span>
                            </div>
                            {rows.slice(0, 50).map((r, i) => (
                                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-1.5 text-tp-xs"
                                     style={{ borderTop: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    <span className="font-bold truncate">{r.name}</span>
                                    <span className="font-mono">{r.code || '—'}</span>
                                    <span>{r.short_name || '—'}</span>
                                    <span className="font-mono">{r.barcode_prefix || '—'}</span>
                                    <span>{r.parent_code || '—'}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="rounded-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar"
                             style={{ border: '1px solid var(--app-border)' }}>
                            {results.map((r, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-tp-xs"
                                     style={{ borderTop: i === 0 ? undefined : '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    {r.ok
                                        ? <Check size={13} style={{ color: 'var(--app-success, #22c55e)' }} />
                                        : <AlertTriangle size={13} style={{ color: 'var(--app-error, #ef4444)' }} />}
                                    <span className="font-bold flex-1">{r.name}</span>
                                    {!r.ok && <span className="text-tp-xxs truncate max-w-[280px]" style={{ color: 'var(--app-error, #ef4444)' }}>{r.error}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 flex justify-end gap-2 flex-shrink-0"
                     style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                    <button onClick={onClose} disabled={importing}
                            className="px-4 py-2 rounded-xl text-tp-sm font-bold transition-all"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        {results.length > 0 ? 'Close' : 'Cancel'}
                    </button>
                    {rows.length > 0 && results.length === 0 && (
                        <button onClick={run} disabled={importing}
                                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-tp-sm font-bold text-white transition-all"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 35%, transparent)' }}>
                            {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                            Import {rows.length}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
