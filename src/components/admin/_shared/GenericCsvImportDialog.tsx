'use client';

/**
 * GenericCsvImportDialog — reusable guided CSV import for any master-data
 * entity. Ships with an inline tutorial (column spec + sample + template
 * download) and a 4-step progress strip (Prepare → Upload → Preview → Import).
 *
 * Each caller supplies:
 *   - entity label ("brand", "attribute", …) for header text
 *   - column specs with required/description/example
 *   - a sample CSV string (becomes the downloadable template)
 *   - a buildPayload(row) → API body mapper
 *   - the endpoint path (e.g. "brands/")
 *   - preview columns (small subset of fields to show in the table)
 */

import { useMemo, useRef, useState } from 'react';
import {
    X, Upload, FileText, Loader2, Check, AlertTriangle, Download,
    BookOpen, ClipboardCopy, ClipboardCheck, ArrowRight, Lightbulb,
    ChevronDown,
} from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import { parseSpreadsheet, SPREADSHEET_ACCEPT } from './file-parser';

export interface ColumnSpec {
    name: string;
    required: boolean;
    desc: string;
    example: string;
}

export interface PreviewColumn {
    key: string;
    label: string;
    /** Render the cell value — default is string coercion. */
    render?: (row: Record<string, string>) => React.ReactNode;
    mono?: boolean;
}

export interface GenericCsvImportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onDone: () => void;
    /** Singular noun, e.g. "brand", "category". */
    entity: string;
    /** Plural noun, e.g. "brands", "categories". Defaults to entity + 's'. */
    entityPlural?: string;
    /** Column specs shown in the tutorial's column table. */
    columns: ColumnSpec[];
    /** Full sample CSV text (header + a few rows) — also served as the download template. */
    sampleCsv: string;
    /** Preview table columns. */
    previewColumns: PreviewColumn[];
    /** POST endpoint path (e.g. "brands/", "parfums/"). */
    endpoint: string;
    /** Map a parsed row to the JSON body posted to the endpoint. */
    buildPayload: (row: Record<string, string>) => Record<string, any>;
    /** Optional extra tutorial hint text (shown in the amber tip banner). */
    tip?: React.ReactNode;
    /**
     * Optional custom run — when provided, the dialog delegates the whole
     * batch to this callback instead of looping POST per row. Used by
     * entities that need multi-pass / upsert logic (e.g. units must wire
     * `base_unit` FKs in pass 2 once peer ids are known).
     */
    runImport?: (rows: Record<string, string>[]) => Promise<Result[]>;
}

type Result = { name: string; ok: boolean; error?: string };
type Step = 'prepare' | 'upload' | 'preview' | 'import';


export function GenericCsvImportDialog({
    isOpen, onClose, onDone,
    entity, entityPlural,
    columns, sampleCsv, previewColumns,
    endpoint, buildPayload, tip, runImport,
}: GenericCsvImportDialogProps) {
    const plural = entityPlural || `${entity}s`;
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState<Result[]>([]);
    const [tutorialOpen, setTutorialOpen] = useState(true);
    const [copied, setCopied] = useState(false);
    const [fileName, setFileName] = useState<string>('');
    const [dragOver, setDragOver] = useState(false);

    const currentStep: Step = useMemo(() => {
        if (results.length > 0) return 'import';
        if (rows.length > 0) return 'preview';
        if (!tutorialOpen) return 'upload';
        return 'prepare';
    }, [rows.length, results.length, tutorialOpen]);

    if (!isOpen) return null;

    const onFile = async (f: File) => {
        setFileName(f.name);
        try {
            const parsed = await parseSpreadsheet(f);
            setRows(parsed);
            setResults([]);
            if (parsed.length === 0) toast.warning('No rows detected — check the file has a `name` column.');
        } catch (e: any) {
            toast.error(`Could not read file: ${e?.message || 'unknown error'}`);
        }
    };

    const downloadTemplateCsv = () => {
        const blob = new Blob(['﻿' + sampleCsv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${plural}-template.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV template downloaded');
    };

    const downloadTemplateXlsx = async () => {
        // Lazy-load SheetJS so CSV-only users don't pay the bundle cost.
        try {
            const XLSX = await import('xlsx');
            // Parse the sample CSV into a 2-D array — same shape `parseSpreadsheet`
            // expects on import, so the user can edit and re-upload without
            // worrying about column reordering breaking anything.
            const lines = sampleCsv.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim());
            const matrix = lines.map(line => line.split(',').map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"')));
            const ws = XLSX.utils.aoa_to_sheet(matrix);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, plural.slice(0, 31)); // sheet name capped at 31 chars
            XLSX.writeFile(wb, `${plural}-template.xlsx`);
            toast.success('Excel template downloaded');
        } catch (e: any) {
            toast.error(`Could not generate Excel template: ${e?.message || 'unknown error'}`);
        }
    };

    const copySample = async () => {
        try {
            await navigator.clipboard.writeText(sampleCsv);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error('Clipboard not available');
        }
    };

    const run = async () => {
        setImporting(true);
        let out: Result[];
        if (runImport) {
            // Caller-supplied multi-pass / upsert flow. They own ordering
            // and per-row error handling; we just surface the result list.
            try {
                out = await runImport(rows);
            } catch (e: any) {
                out = rows.map(r => ({ name: r.name, ok: false, error: e?.message || 'import failed' }));
            }
        } else {
            // Default per-row POST loop.
            out = [];
            for (const r of rows) {
                try {
                    await erpFetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(buildPayload(r)),
                    });
                    out.push({ name: r.name, ok: true });
                } catch (e: any) {
                    out.push({ name: r.name, ok: false, error: e?.message || 'failed' });
                }
            }
        }
        setResults(out);
        setImporting(false);
        const ok = out.filter(o => o.ok).length;
        if (ok === out.length) toast.success(`${ok} ${ok === 1 ? entity : plural} imported`);
        else toast.warning(`${ok} imported, ${out.length - ok} failed`);
        if (ok > 0) onDone();
    };

    const steps: { key: Step; label: string; hint: string }[] = [
        { key: 'prepare', label: 'Prepare', hint: 'Format your file' },
        { key: 'upload', label: 'Upload', hint: 'Drop CSV / XLSX' },
        { key: 'preview', label: 'Preview', hint: 'Check rows' },
        { key: 'import', label: 'Import', hint: 'Save to system' },
    ];
    const stepIndex = steps.findIndex(s => s.key === currentStep);

    const gridTemplate = `[${previewColumns.map(() => '1fr').join('_')}]`;
    const gridClass = `grid gap-3`;
    const gridStyle: React.CSSProperties = {
        gridTemplateColumns: previewColumns.map((c, i) => i === 0 ? '1fr' : 'auto').join(' '),
    };

    return (
        <div
            className="fixed inset-0 z-[115] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-2xl max-h-[92vh] rounded-2xl flex flex-col overflow-hidden"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>

                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                     style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                             style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Upload size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-app-foreground capitalize">Import {plural}</h3>
                            <p className="text-tp-xs font-bold text-app-muted-foreground">Bulk create from CSV / XLS / XLSX</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* Progress strip */}
                <div className="px-5 py-3 flex items-center gap-1.5 flex-shrink-0 overflow-x-auto custom-scrollbar"
                     style={{ background: 'color-mix(in srgb, var(--app-background) 50%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    {steps.map((s, i) => {
                        const done = i < stepIndex;
                        const active = i === stepIndex;
                        return (
                            <div key={s.key} className="flex items-center gap-1.5 flex-shrink-0">
                                <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-tp-xxs font-bold transition-all"
                                    style={{
                                        background: done || active ? 'var(--app-primary)' : 'var(--app-background)',
                                        color: done || active ? 'white' : 'var(--app-muted-foreground)',
                                        border: `1px solid ${done || active ? 'var(--app-primary)' : 'var(--app-border)'}`,
                                        boxShadow: active ? '0 0 0 3px color-mix(in srgb, var(--app-primary) 15%, transparent)' : undefined,
                                    }}
                                >
                                    {done ? <Check size={11} strokeWidth={3} /> : i + 1}
                                </div>
                                <div className="leading-tight">
                                    <p className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: active ? 'var(--app-primary)' : 'var(--app-foreground)' }}>
                                        {s.label}
                                    </p>
                                    <p className="text-tp-xxs font-bold text-app-muted-foreground">{s.hint}</p>
                                </div>
                                {i < steps.length - 1 && (
                                    <ArrowRight size={10} className="mx-1 flex-shrink-0" style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

                    {/* Tutorial card */}
                    <div className="rounded-xl overflow-hidden"
                         style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)' }}>
                        <button
                            type="button"
                            onClick={() => setTutorialOpen(o => !o)}
                            className="w-full px-3 py-2.5 flex items-center gap-2 text-left transition-all hover:bg-[color-mix(in_srgb,var(--app-info,#3b82f6)_6%,transparent)]"
                        >
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                 style={{ background: 'var(--app-info, #3b82f6)', color: 'white' }}>
                                <BookOpen size={12} />
                            </div>
                            <div className="flex-1">
                                <p className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>How to prepare your CSV</p>
                                <p className="text-tp-xxs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {tutorialOpen ? 'Close to skip ahead' : `${columns.length} columns · Download template ready`}
                                </p>
                            </div>
                            <ChevronDown
                                size={14}
                                className="transition-transform"
                                style={{
                                    color: 'var(--app-muted-foreground)',
                                    transform: tutorialOpen ? 'rotate(180deg)' : undefined,
                                }}
                            />
                        </button>

                        {tutorialOpen && (
                            <div className="px-3 pb-3 space-y-3">
                                {/* Column spec */}
                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                                    <div className="grid grid-cols-[110px_1fr_110px] gap-2 px-3 py-1.5 text-tp-xxs font-bold uppercase tracking-widest"
                                         style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>
                                        <span>Column</span>
                                        <span>Description</span>
                                        <span>Example</span>
                                    </div>
                                    {columns.map(c => (
                                        <div key={c.name}
                                             className="grid grid-cols-[110px_1fr_110px] gap-2 px-3 py-1.5 text-tp-xs items-center"
                                             style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                                            <span className="flex items-center gap-1 min-w-0">
                                                <code className="font-mono font-bold truncate" style={{ color: 'var(--app-foreground)' }}>{c.name}</code>
                                                {c.required && (
                                                    <span className="text-tp-xxs font-bold px-1 rounded flex-shrink-0"
                                                          style={{ background: 'color-mix(in srgb, var(--app-error) 12%, transparent)', color: 'var(--app-error)' }}>
                                                        *
                                                    </span>
                                                )}
                                            </span>
                                            <span style={{ color: 'var(--app-muted-foreground)' }}>{c.desc}</span>
                                            <code className="font-mono text-tp-xxs truncate" style={{ color: 'var(--app-foreground)' }}>{c.example}</code>
                                        </div>
                                    ))}
                                </div>

                                {/* Sample + copy */}
                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                                    <div className="px-3 py-1.5 flex items-center gap-2 text-tp-xxs font-bold uppercase tracking-widest"
                                         style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>
                                        <FileText size={10} />
                                        <span className="flex-1">Sample content</span>
                                        <button
                                            type="button"
                                            onClick={copySample}
                                            className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-all hover:bg-app-surface"
                                            style={{ color: copied ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}
                                        >
                                            {copied ? <ClipboardCheck size={10} /> : <ClipboardCopy size={10} />}
                                            {copied ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                    <pre className="px-3 py-2 text-tp-xs font-mono overflow-x-auto custom-scrollbar"
                                         style={{ background: 'var(--app-background)', color: 'var(--app-foreground)' }}>
{sampleCsv}
                                    </pre>
                                </div>

                                {/* Tip + download template */}
                                <div className="flex flex-col sm:flex-row gap-2">
                                    {tip && (
                                        <div className="flex-1 flex items-start gap-2 p-2.5 rounded-xl text-tp-xs font-bold"
                                             style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)', color: 'var(--app-foreground)' }}>
                                            <Lightbulb size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                            <span>{tip}</span>
                                        </div>
                                    )}
                                    <div className="flex items-stretch gap-1.5 flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={downloadTemplateCsv}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-tp-xs font-bold transition-all hover:brightness-110"
                                            style={{
                                                background: 'var(--app-primary)',
                                                color: 'white',
                                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                            }}
                                            title="Plain-text template — opens in any editor"
                                        >
                                            <Download size={12} />
                                            CSV
                                        </button>
                                        <button
                                            type="button"
                                            onClick={downloadTemplateXlsx}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-tp-xs font-bold transition-all"
                                            style={{
                                                background: 'transparent',
                                                color: 'var(--app-primary)',
                                                border: '1px solid color-mix(in srgb, var(--app-primary) 35%, transparent)',
                                            }}
                                            title="Excel-formatted template — opens in Excel/Numbers/Sheets"
                                        >
                                            <Download size={12} />
                                            XLSX
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Drop zone */}
                    <div
                        onClick={() => fileRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
                        className="p-6 rounded-2xl text-center cursor-pointer transition-all"
                        style={{
                            border: `2px dashed ${dragOver ? 'var(--app-primary)' : 'var(--app-border)'}`,
                            background: dragOver
                                ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)'
                                : rows.length > 0
                                    ? 'color-mix(in srgb, var(--app-success, #22c55e) 5%, transparent)'
                                    : 'color-mix(in srgb, var(--app-primary) 4%, transparent)',
                        }}
                    >
                        {rows.length > 0 ? (
                            <>
                                <div className="w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center"
                                     style={{ background: 'var(--app-success, #22c55e)', color: 'white' }}>
                                    <Check size={18} strokeWidth={3} />
                                </div>
                                <p className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>
                                    {fileName || 'File loaded'}
                                </p>
                                <p className="text-tp-xs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {rows.length} row{rows.length === 1 ? '' : 's'} detected — click to replace
                                </p>
                            </>
                        ) : (
                            <>
                                <FileText size={28} className="mx-auto mb-2" style={{ color: 'var(--app-primary)' }} />
                                <p className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>
                                    Drop your file here
                                </p>
                                <p className="text-tp-xs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                    .csv · .xls · .xlsx — or click to browse
                                </p>
                            </>
                        )}
                        <input ref={fileRef} type="file" accept={SPREADSHEET_ACCEPT} className="hidden"
                               onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
                    </div>

                    {/* Preview */}
                    {rows.length > 0 && results.length === 0 && (
                        <div className="rounded-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar"
                             style={{ border: '1px solid var(--app-border)' }}>
                            <div className={gridClass} style={{ ...gridStyle, background: 'var(--app-background)' }}>
                                {previewColumns.map(c => (
                                    <span key={c.key} className="px-3 py-2 text-tp-xxs font-bold uppercase tracking-widest"
                                          style={{ color: 'var(--app-muted-foreground)' }}>
                                        {c.label}
                                    </span>
                                ))}
                            </div>
                            {rows.slice(0, 50).map((r, i) => (
                                <div key={i} className={gridClass}
                                     style={{ ...gridStyle, borderTop: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    {previewColumns.map((c, ci) => (
                                        <span key={c.key}
                                              className={`px-3 py-1.5 text-tp-xs ${ci === 0 ? 'font-bold truncate' : ''} ${c.mono ? 'font-mono' : ''}`}>
                                            {c.render ? c.render(r) : (r[c.key] || '—')}
                                        </span>
                                    ))}
                                </div>
                            ))}
                            {rows.length > 50 && (
                                <div className="px-3 py-2 text-tp-xxs font-bold text-center"
                                     style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>
                                    +{rows.length - 50} more rows not shown
                                </div>
                            )}
                        </div>
                    )}

                    {/* Results */}
                    {results.length > 0 && (
                        <div className="rounded-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar"
                             style={{ border: '1px solid var(--app-border)' }}>
                            {results.map((r, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-tp-xs"
                                     style={{ borderTop: i === 0 ? undefined : '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    {r.ok
                                        ? <Check size={13} style={{ color: 'var(--app-success, #22c55e)' }} />
                                        : <AlertTriangle size={13} style={{ color: 'var(--app-error, #ef4444)' }} />}
                                    <span className="font-bold flex-1 truncate">{r.name}</span>
                                    {!r.ok && <span className="text-tp-xxs truncate max-w-[280px]" style={{ color: 'var(--app-error, #ef4444)' }}>{r.error}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 flex items-center gap-2 flex-shrink-0"
                     style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 40%, var(--app-surface))' }}>
                    <div className="flex-1 text-tp-xs font-bold text-app-muted-foreground">
                        {results.length > 0
                            ? `${results.filter(r => r.ok).length} / ${results.length} imported`
                            : rows.length > 0
                                ? `Ready to import ${rows.length} row${rows.length === 1 ? '' : 's'}`
                                : 'Waiting for file…'}
                    </div>
                    <button onClick={onClose} disabled={importing}
                            className="px-4 py-2 rounded-xl text-tp-xs font-bold transition-all disabled:opacity-50"
                            style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        {results.length > 0 ? 'Close' : 'Cancel'}
                    </button>
                    {rows.length > 0 && results.length === 0 && (
                        <button onClick={run} disabled={importing}
                                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-tp-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                            Import {rows.length}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
