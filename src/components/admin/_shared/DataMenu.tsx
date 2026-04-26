'use client';

/**
 * Shared Data ▾ dropdown — consolidates Export / Import / Print for any
 * master-data list page. Uses Radix primitives with our theme tokens so
 * it matches the modal/section design language.
 *
 * Plug it into TreeMasterPage via:
 *   secondaryActions: [{ label: 'Data', icon: <Database/>, render: () => (
 *     <DataMenu onExport={...} onImport={...} onPrint={...} />
 *   ) }]
 */

import * as DM from '@radix-ui/react-dropdown-menu';
import {
    Database, ChevronDown, Download, Upload, Printer, ArrowRightLeft, FileSpreadsheet,
} from 'lucide-react';

type Props = {
    /** CSV export — plain text, best for re-import. */
    onExport?: () => void;
    /** Excel export — opens natively in Excel, best for humans. */
    onExportExcel?: () => void;
    onImport?: () => void;
    onPrint?: () => void;
    /** Optional label override (e.g. "Brand data"). */
    title?: string;
};

function MenuItem({ icon, iconColor, label, hint, onSelect }: {
    icon: React.ReactNode;
    iconColor: string;
    label: string;
    hint?: string;
    onSelect: () => void;
}) {
    return (
        <DM.Item
            onSelect={onSelect}
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg outline-none cursor-pointer transition-all data-[highlighted]:bg-[color-mix(in_srgb,var(--app-primary)_10%,transparent)] data-[highlighted]:text-app-primary"
            style={{ color: 'var(--app-foreground)' }}
        >
            <span
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: `color-mix(in srgb, ${iconColor} 12%, transparent)`,
                    color: iconColor,
                }}
            >
                {icon}
            </span>
            <span className="flex-1 text-tp-sm font-bold">{label}</span>
            {hint && (
                <span
                    className="text-tp-xxs font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{
                        background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)',
                        color: 'var(--app-muted-foreground)',
                    }}
                >
                    {hint}
                </span>
            )}
        </DM.Item>
    );
}

export function DataMenu({ onExport, onExportExcel, onImport, onPrint, title = 'Data Transfer' }: Props) {
    return (
        <DM.Root>
            <DM.Trigger asChild>
                <button
                    className="flex items-center gap-1.5 text-tp-sm font-bold px-2.5 py-1.5 rounded-xl border transition-all hover:bg-app-surface data-[state=open]:bg-app-surface"
                    style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}
                >
                    <Database size={13} />
                    <span>Data</span>
                    <ChevronDown size={11} className="opacity-60 transition-transform data-[state=open]:rotate-180" />
                </button>
            </DM.Trigger>
            <DM.Portal>
                <DM.Content
                    align="end"
                    sideOffset={6}
                    className="z-[120] w-64 overflow-hidden rounded-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25), 0 4px 12px color-mix(in srgb, var(--app-primary) 6%, transparent)',
                    }}
                >
                    <div
                        className="px-3 py-2.5 flex items-center gap-2"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                            borderBottom: '1px solid var(--app-border)',
                        }}
                    >
                        <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 4px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}
                        >
                            <ArrowRightLeft size={13} className="text-white" />
                        </div>
                        <div>
                            <p className="text-tp-sm font-bold text-app-foreground leading-tight">{title}</p>
                            <p className="text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wide leading-tight">
                                Import · Export · Print
                            </p>
                        </div>
                    </div>

                    <div className="p-1.5 space-y-0.5">
                        {onExportExcel && (
                            <MenuItem
                                icon={<FileSpreadsheet size={13} />}
                                iconColor="var(--app-success)"
                                label="Export Excel"
                                hint=".xls"
                                onSelect={onExportExcel}
                            />
                        )}
                        {onExport && (
                            <MenuItem
                                icon={<Download size={13} />}
                                iconColor="var(--app-muted-foreground)"
                                label="Export CSV"
                                hint=".csv"
                                onSelect={onExport}
                            />
                        )}
                        {onImport && (
                            <MenuItem
                                icon={<Upload size={13} />}
                                iconColor="var(--app-info, #3b82f6)"
                                label="Import CSV"
                                hint="Bulk"
                                onSelect={onImport}
                            />
                        )}
                        {onPrint && (
                            <>
                                <div className="my-1 mx-1 h-px" style={{ background: 'var(--app-border)' }} />
                                <MenuItem
                                    icon={<Printer size={13} />}
                                    iconColor="var(--app-warning, #f59e0b)"
                                    label="Print list"
                                    hint="⌘P"
                                    onSelect={onPrint}
                                />
                            </>
                        )}
                    </div>
                </DM.Content>
            </DM.Portal>
        </DM.Root>
    );
}
