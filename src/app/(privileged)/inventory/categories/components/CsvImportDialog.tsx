'use client';

/**
 * CsvImportDialog — guided CSV import for categories.
 *
 * Ships with an inline tutorial so non-technical users can prepare the file
 * without leaving the dialog: column spec, downloadable template, live sample
 * row, and a 4-step progress strip (Prepare → Upload → Preview → Import).
 *
 * Expected columns (headers case-insensitive):
 *   name (required) · code · short_name · barcode_prefix · parent_code
 *
 * parent_code is a lookup into existing categories by `code` or `name`.
 * Unknown parents are treated as roots. Each row fires a POST to
 * /api/inventory/categories/; we surface errors per row without aborting.
 */

import { useMemo, useRef, useState } from 'react';
import {
    X, Upload, FileText, Loader2, Check, AlertTriangle, Download,
    BookOpen, ClipboardCopy, ClipboardCheck, ArrowRight, Lightbulb,
    ChevronDown,
} from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import type { CategoryNode } from './types';
import { parseSpreadsheet, SPREADSHEET_ACCEPT } from '@/components/admin/_shared/file-parser';
import { useTranslation } from '@/hooks/use-translation';

interface Props {
    allCategories: CategoryNode[];
    onClose: () => void;
    onDone: () => void;
}

type Row = { name: string; code?: string; short_name?: string; barcode_prefix?: string; parent_code?: string };
type Result = { name: string; ok: boolean; error?: string; row?: Row };
type Step = 'prepare' | 'upload' | 'preview' | 'import';

/** Per-row validation status — drives the preview badges + the guard that
 *  decides what gets posted. Only `new` rows are sent to the API. */
type RowStatus = 'new' | 'duplicate' | 'warning' | 'invalid';
interface RowValidation {
    status: RowStatus;
    reasons: string[];
    resolvedParentId: number | null;
}

function validateRows(rows: Row[], allCategories: CategoryNode[]): RowValidation[] {
    // Index existing tenant data for O(1) duplicate lookup.
    const existingByName = new Map<string, CategoryNode>();
    const existingByCode = new Map<string, CategoryNode>();
    allCategories.forEach(c => {
        existingByName.set(c.name.toLowerCase(), c);
        if (c.code) existingByCode.set(c.code.toLowerCase(), c);
    });
    // Catch duplicates *within* the file too — first occurrence wins,
    // subsequent ones are flagged duplicate.
    const seenNames = new Set<string>();
    const seenCodes = new Set<string>();

    return rows.map(r => {
        const reasons: string[] = [];
        const name = (r.name || '').trim();
        const code = (r.code || '').trim();
        const prefix = (r.barcode_prefix || '').trim();
        const parentCode = (r.parent_code || '').trim();

        // Required
        if (!name) {
            return { status: 'invalid', reasons: ['Missing name'], resolvedParentId: null };
        }
        if (name.length < 2) {
            return { status: 'invalid', reasons: ['Name too short (min 2 chars)'], resolvedParentId: null };
        }
        if (prefix && !/^\d+$/.test(prefix)) {
            return { status: 'invalid', reasons: ['Barcode prefix must be digits only'], resolvedParentId: null };
        }

        // Duplicate detection — DB + in-file
        const nameKey = name.toLowerCase();
        const codeKey = code.toLowerCase();
        if (existingByName.has(nameKey)) reasons.push(`Name "${name}" already exists`);
        if (code && existingByCode.has(codeKey)) reasons.push(`Code "${code}" already in use`);
        if (seenNames.has(nameKey)) reasons.push(`Duplicate name in file`);
        if (code && seenCodes.has(codeKey)) reasons.push(`Duplicate code in file`);
        seenNames.add(nameKey);
        if (code) seenCodes.add(codeKey);

        if (reasons.length) {
            return { status: 'duplicate', reasons, resolvedParentId: null };
        }

        // Parent resolution — match by code OR name (case-insensitive).
        let resolvedParentId: number | null = null;
        if (parentCode) {
            const pcKey = parentCode.toLowerCase();
            const parent = existingByCode.get(pcKey) || existingByName.get(pcKey);
            if (parent) {
                resolvedParentId = parent.id;
            } else {
                return {
                    status: 'warning',
                    reasons: [`Parent "${parentCode}" not found — will be created as root`],
                    resolvedParentId: null,
                };
            }
        }

        return { status: 'new', reasons: [], resolvedParentId };
    });
}

const COLS: { name: string; required: boolean; desc: string; example: string }[] = [
    { name: 'name', required: true, desc: 'Display name — must be unique per tenant', example: 'Beverages' },
    { name: 'code', required: false, desc: 'Your internal reference (unique)', example: '1001' },
    { name: 'short_name', required: false, desc: '3-letter abbreviation', example: 'BEV' },
    { name: 'barcode_prefix', required: false, desc: 'Leading digits for auto-barcodes', example: '0410' },
    { name: 'parent_code', required: false, desc: 'Parent category — lookup by code or name', example: '1000' },
];

const SAMPLE_CSV = [
    'name,code,short_name,barcode_prefix,parent_code',
    'Beverages,1000,BEV,0400,',
    'Soft Drinks,1001,SOFT,0410,1000',
    'Coffee & Tea,1002,COFFEE,0420,1000',
    'Snacks,2000,SNCK,0500,',
].join('\n');

const STATUS_COLOR: Record<'new' | 'warning' | 'duplicate' | 'invalid', string> = {
    new: 'var(--app-success, #22c55e)',
    warning: 'var(--app-warning, #f59e0b)',
    duplicate: 'var(--app-muted-foreground)',
    invalid: 'var(--app-error, #ef4444)',
};
const STATUS_LABEL: Record<'new' | 'warning' | 'duplicate' | 'invalid', string> = {
    new: 'New',
    warning: 'Warning',
    duplicate: 'Duplicate',
    invalid: 'Invalid',
};

function StatusDot({ status }: { status: 'new' | 'warning' | 'duplicate' | 'invalid' }) {
    const color = STATUS_COLOR[status];
    return (
        <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 0 2px color-mix(in srgb, ${color} 20%, transparent)` }}
            title={STATUS_LABEL[status]}
        />
    );
}

function StatusChip({ kind, count }: { kind: 'new' | 'warning' | 'duplicate' | 'invalid'; count: number }) {
    if (count === 0) return null;
    const color = STATUS_COLOR[kind];
    return (
        <span
            className="inline-flex items-center gap-1 text-tp-xxs font-bold px-2 py-0.5 rounded-full"
            style={{
                background: `color-mix(in srgb, ${color} 10%, transparent)`,
                color,
                border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
            }}
        >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {count} {STATUS_LABEL[kind].toLowerCase()}
        </span>
    );
}


export function CsvImportDialog({ allCategories, onClose, onDone }: Props) {
    const { t } = useTranslation();
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
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

    // Validate every row against existing tenant data + in-file duplicates.
    // Recomputed whenever the loaded rows change.
    const validations = useMemo(
        () => validateRows(rows, allCategories),
        [rows, allCategories]
    );
    const stats = useMemo(() => {
        const s = { new: 0, duplicate: 0, warning: 0, invalid: 0 };
        validations.forEach(v => { s[v.status]++; });
        return s;
    }, [validations]);
    const importableCount = stats.new + stats.warning;

    const onFile = async (f: File) => {
        setFileName(f.name);
        try {
            const parsed = await parseSpreadsheet(f);
            setRows(parsed as Row[]);
            setResults([]);
            if (parsed.length === 0) toast.warning('No rows detected — check the file has a `name` column.');
        } catch (e: any) {
            toast.error(`Could not read file: ${e?.message || 'unknown error'}`);
        }
    };

    const downloadTemplate = () => {
        const blob = new Blob(['﻿' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'categories-template.csv';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Template downloaded');
    };

    const copySample = async () => {
        try {
            await navigator.clipboard.writeText(SAMPLE_CSV);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error('Clipboard not available');
        }
    };

    // Only rows that are `new` or `warning` actually get posted. Rows flagged
    // `duplicate` or `invalid` are recorded as pre-flight skips so the user
    // sees the full picture and can download the un-imported rows later.
    const run = async () => {
        setImporting(true);
        const out: Result[] = [];

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const v = validations[i];
            if (v.status === 'invalid' || v.status === 'duplicate') {
                out.push({
                    name: r.name || '(no name)',
                    ok: false,
                    error: v.reasons.join('; ') || v.status,
                    row: r,
                });
                continue;
            }
            try {
                await erpFetch('inventory/categories/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: r.name,
                        code: r.code || null,
                        short_name: r.short_name || null,
                        barcode_prefix: r.barcode_prefix || '',
                        parent: v.resolvedParentId ?? null,
                    }),
                });
                out.push({ name: r.name, ok: true, row: r });
            } catch (e: any) {
                // Surface DRF field errors verbatim so the user can fix them
                // and re-import without guessing what went wrong.
                const data = (e as any)?.data || (e as any)?.body;
                let msg = e?.message || 'failed';
                if (data && typeof data === 'object') {
                    const parts = Object.entries(data).map(([k, v]) =>
                        `${k}: ${Array.isArray(v) ? v.join(' ') : String(v)}`
                    );
                    if (parts.length) msg = parts.join(' · ');
                }
                out.push({ name: r.name, ok: false, error: msg, row: r });
            }
        }

        setResults(out);
        setImporting(false);
        const ok = out.filter(o => o.ok).length;
        const failed = out.length - ok;
        if (failed === 0 && ok > 0) {
            toast.success(`${ok} categor${ok === 1 ? 'y' : 'ies'} imported`);
        } else if (ok === 0) {
            toast.error(`Nothing imported — ${failed} row${failed === 1 ? '' : 's'} blocked`);
        } else {
            toast.warning(`${ok} imported, ${failed} failed — download un-imported rows to fix`);
        }
        if (ok > 0) onDone();
    };

    /** Export rows that did NOT import (pre-flight skips OR API failures) as
     *  a CSV with the exact original columns + an `error` column. Users can
     *  open it in Excel, fix the problem, and drop it back in for a re-run. */
    const downloadFailed = () => {
        const failed = results.filter(r => !r.ok);
        if (failed.length === 0) return;
        const escape = (v: any) => {
            const s = (v ?? '').toString();
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const headers = ['name', 'code', 'short_name', 'barcode_prefix', 'parent_code', 'error'];
        const lines = [headers.join(',')];
        failed.forEach(f => {
            const r = f.row || ({} as Row);
            lines.push([
                r.name || '',
                r.code || '',
                r.short_name || '',
                r.barcode_prefix || '',
                r.parent_code || '',
                f.error || '',
            ].map(escape).join(','));
        });
        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `categories-failed-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${failed.length} un-imported rows`);
    };

    const steps: { key: Step; label: string; hint: string }[] = [
        { key: 'prepare', label: 'Prepare', hint: 'Format your file' },
        { key: 'upload', label: 'Upload', hint: 'Drop CSV file' },
        { key: 'preview', label: 'Preview', hint: 'Check rows' },
        { key: 'import', label: 'Import', hint: 'Save to system' },
    ];
    const stepIndex = steps.findIndex(s => s.key === currentStep);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
             onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-2xl max-h-[92vh] rounded-2xl flex flex-col overflow-hidden"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>

                {/* ── Header ── */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                     style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                             style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Upload size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-app-foreground">{t('inventory.categories_page.csv_import_title')}</h3>
                            <p className="text-tp-xs font-bold text-app-muted-foreground">{t('inventory.categories_page.csv_import_subtitle')}</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* ── Progress strip ── */}
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

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

                    {/* Tutorial card (collapsible) */}
                    <div
                        className="rounded-xl overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)' }}
                    >
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
                                <p className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>{t('inventory.categories_page.csv_how_to')}</p>
                                <p className="text-tp-xxs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {tutorialOpen ? 'Close to skip ahead' : `${COLS.length} columns · Download template ready`}
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
                                {/* Column spec table */}
                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                                    <div className="grid grid-cols-[110px_1fr_110px] gap-2 px-3 py-1.5 text-tp-xxs font-bold uppercase tracking-widest"
                                         style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>
                                        <span>Column</span>
                                        <span>Description</span>
                                        <span>Example</span>
                                    </div>
                                    {COLS.map(c => (
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

                                {/* Sample CSV code block + actions */}
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
{SAMPLE_CSV}
                                    </pre>
                                </div>

                                {/* Tips + download template */}
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="flex-1 flex items-start gap-2 p-2.5 rounded-xl text-tp-xs font-bold"
                                         style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)', color: 'var(--app-foreground)' }}>
                                        <Lightbulb size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                        <span>
                                            <strong>Tip:</strong> Put parents first. Sub-categories reference their parent via <code className="font-mono">parent_code</code> (matched to an existing <code className="font-mono">code</code> or <code className="font-mono">name</code>).
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={downloadTemplate}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-tp-xs font-bold transition-all hover:brightness-110 flex-shrink-0"
                                        style={{
                                            background: 'var(--app-primary)',
                                            color: 'white',
                                            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                        }}
                                    >
                                        <Download size={12} />
                                        Download template
                                    </button>
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
                                    Drop your CSV or Excel file here
                                </p>
                                <p className="text-tp-xs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                    <span className="font-mono">.csv</span> · <span className="font-mono">.xls</span> · <span className="font-mono">.xlsx</span> — or click to browse
                                </p>
                            </>
                        )}
                        <input ref={fileRef} type="file" accept={SPREADSHEET_ACCEPT} className="hidden"
                               onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
                    </div>

                    {/* Preview + validation summary. Status chips at top give a
                        bird's-eye of what's safe to import; the per-row badge
                        tells the user exactly *why* a row is skipped. */}
                    {rows.length > 0 && results.length === 0 && (
                        <div className="space-y-2">
                            {/* Summary strip */}
                            <div className="flex items-center flex-wrap gap-1.5">
                                <StatusChip kind="new" count={stats.new} />
                                <StatusChip kind="warning" count={stats.warning} />
                                <StatusChip kind="duplicate" count={stats.duplicate} />
                                <StatusChip kind="invalid" count={stats.invalid} />
                                <span className="ml-auto text-tp-xxs font-bold text-app-muted-foreground">
                                    {importableCount} of {rows.length} will be imported
                                </span>
                            </div>

                            <div className="rounded-xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar"
                                 style={{ border: '1px solid var(--app-border)' }}>
                                <table className="w-full border-collapse text-tp-xs" style={{ color: 'var(--app-foreground)' }}>
                                    <thead className="sticky top-0" style={{ background: 'var(--app-background)' }}>
                                        <tr className="text-tp-xxs font-bold uppercase tracking-widest"
                                            style={{ color: 'var(--app-muted-foreground)' }}>
                                            <th className="text-left px-2 py-2 font-bold w-8"></th>
                                            <th className="text-left px-3 py-2 font-bold">Name</th>
                                            <th className="text-left px-3 py-2 font-bold">Code</th>
                                            <th className="text-left px-3 py-2 font-bold">Short</th>
                                            <th className="text-left px-3 py-2 font-bold">Prefix</th>
                                            <th className="text-left px-3 py-2 font-bold">Parent</th>
                                            <th className="text-left px-3 py-2 font-bold">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.slice(0, 50).map((r, i) => {
                                            const v = validations[i];
                                            return (
                                                <tr key={i} style={{ borderTop: '1px solid var(--app-border)' }}>
                                                    <td className="px-2 py-1.5 text-center">
                                                        <StatusDot status={v.status} />
                                                    </td>
                                                    <td className="px-3 py-1.5 font-bold truncate max-w-[220px]">{r.name || '—'}</td>
                                                    <td className="px-3 py-1.5 font-mono">{r.code || '—'}</td>
                                                    <td className="px-3 py-1.5">{r.short_name || '—'}</td>
                                                    <td className="px-3 py-1.5 font-mono">{r.barcode_prefix || '—'}</td>
                                                    <td className="px-3 py-1.5">{r.parent_code || '—'}</td>
                                                    <td className="px-3 py-1.5">
                                                        {v.reasons.length > 0 ? (
                                                            <span className="text-tp-xxs font-bold" style={{ color: STATUS_COLOR[v.status] }}>
                                                                {v.reasons[0]}
                                                            </span>
                                                        ) : (
                                                            <span className="text-tp-xxs font-bold" style={{ color: STATUS_COLOR[v.status] }}>
                                                                Ready
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {rows.length > 50 && (
                                    <div className="px-3 py-2 text-tp-xxs font-bold text-center"
                                         style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>
                                        +{rows.length - 50} more rows not shown
                                    </div>
                                )}
                            </div>
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

                {/* ── Footer ── */}
                <div className="px-5 py-3 flex items-center gap-2 flex-shrink-0"
                     style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 40%, var(--app-surface))' }}>
                    <div className="flex-1 text-tp-xs font-bold text-app-muted-foreground">
                        {results.length > 0
                            ? `${results.filter(r => r.ok).length} / ${results.length} imported`
                            : rows.length > 0
                                ? (importableCount > 0
                                    ? `Ready to import ${importableCount} of ${rows.length} row${rows.length === 1 ? '' : 's'}`
                                    : `Nothing to import — fix ${rows.length - importableCount} flagged row${rows.length - importableCount === 1 ? '' : 's'}`)
                                : 'Waiting for file…'}
                    </div>
                    {/* Post-import: let users download the un-imported rows so
                        they can fix in Excel and drop back in. */}
                    {results.length > 0 && results.some(r => !r.ok) && (
                        <button onClick={downloadFailed}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-tp-xs font-bold transition-all hover:brightness-110"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
                                    color: 'var(--app-error, #ef4444)',
                                    border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)',
                                }}>
                            <Download size={12} />
                            Download {results.filter(r => !r.ok).length} un-imported
                        </button>
                    )}
                    <button onClick={onClose} disabled={importing}
                            className="px-4 py-2 rounded-xl text-tp-xs font-bold transition-all disabled:opacity-50"
                            style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        {results.length > 0 ? 'Close' : 'Cancel'}
                    </button>
                    {rows.length > 0 && results.length === 0 && (
                        <button onClick={run} disabled={importing || importableCount === 0}
                                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-tp-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                            Import {importableCount}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
