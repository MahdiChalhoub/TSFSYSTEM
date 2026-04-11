'use client';
import React, { useState, useCallback, useMemo, ReactNode } from 'react';
import {
    Save, Loader2, Download, Upload, Copy, Undo2,
    ChevronDown, ChevronUp, Search, Printer, FileJson, HelpCircle,
    X, Settings2
} from 'lucide-react';
import { useKeyboardShortcuts, type ShortcutDef } from '../hooks/useKeyboardShortcuts';
import { useAutoSaveDraft } from '../hooks/useAutoSaveDraft';
import { useUndoStack } from '../hooks/useUndoStack';
import { useConfigExport } from '../hooks/useConfigExport';
import { useCollapsibleSections } from '../hooks/useCollapsibleSections';
import { useFieldLocking } from '../hooks/useFieldLocking';
import { useConfigSearch } from '../hooks/useConfigSearch';
import { DraftIndicator } from './DraftIndicator';
import { UndoButton } from './UndoButton';
import { FieldSearchBar } from './FieldSearchBar';
import { CompletenessMeter } from './CompletenessMeter';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

// ═══════════════════════════════════════════════════════════════
// SETTINGS PAGE SHELL — Universal Settings Page Wrapper
// ═══════════════════════════════════════════════════════════════
// Wrap ANY settings page in this component to get all enterprise
// features for FREE: keyboard shortcuts, auto-save, undo/redo,
// export/import, search, completeness meter, draft indicator.
// ═══════════════════════════════════════════════════════════════

export interface SettingsPageShellProps {
    /** Page title displayed in the header */
    title: string;
    /** Subtitle text below title */
    subtitle?: string;
    /** Icon element rendered in the header badge */
    icon: ReactNode;
    /** Unique key for localStorage draft (e.g., 'pos_settings') */
    configKey: string;
    /** Current config data (for auto-save, export, undo) */
    config?: Record<string, any> | null;
    /** Original config data (for diff detection) */
    originalConfig?: Record<string, any> | null;
    /** Whether there are unsaved changes */
    hasChanges?: boolean;
    /** Save handler — wired to Ctrl+S */
    onSave?: () => void;
    /** Whether save is in progress */
    saving?: boolean;
    /** Reload handler — wired to Ctrl+R */
    onReload?: () => void;
    /** Completeness score (0-100). Pass -1 to hide. */
    completenessScore?: number;
    /** Section IDs for expand/collapse all */
    sectionIds?: string[];
    /** Searchable fields for the search bar */
    searchableFields?: Array<{ key: string; label: string; section?: string }>;
    /** Additional shortcut definitions */
    extraShortcuts?: ShortcutDef[];
    /** Additional toolbar buttons */
    extraToolbarItems?: ReactNode;
    /** Whether to show the search bar (default: true if searchableFields provided) */
    showSearch?: boolean;
    /** Whether to show the completeness meter (default: true if score >= 0) */
    showCompleteness?: boolean;
    /** Whether to show export/import buttons (default: true) */
    showExport?: boolean;
    /** Whether to show undo button (default: true if onSave provided) */
    showUndo?: boolean;
    /** Auto-save interval in ms (default: 30000) */
    autoSaveInterval?: number;
    /** Last modified by indicator */
    lastModifiedBy?: string;
    /** Last modified timestamp */
    lastModifiedAt?: string;
    /** Children — the actual page content */
    children: ReactNode;
}

export function SettingsPageShell({
    title,
    subtitle,
    icon,
    configKey,
    config = null,
    originalConfig = null,
    hasChanges = false,
    onSave,
    saving = false,
    onReload,
    completenessScore = -1,
    sectionIds = [],
    searchableFields = [],
    extraShortcuts = [],
    extraToolbarItems,
    showSearch = true,
    showCompleteness = true,
    showExport = true,
    showUndo = true,
    autoSaveInterval = 30000,
    lastModifiedBy,
    lastModifiedAt,
    children,
}: SettingsPageShellProps) {
    // ─── Framework Hooks ─────────────────────────────────────────
    const { draftSavedAt } = useAutoSaveDraft(
        `${configKey}_draft`, config, hasChanges, autoSaveInterval
    );

    const undoStack = useUndoStack();

    const { exportJSON, copyToClipboard } = useConfigExport(config, configKey);

    const { allCollapsed, toggleAll } = useCollapsibleSections(sectionIds);

    const {
        search, setSearch, isVisible: isFieldVisible, matchCount,
    } = useConfigSearch(searchableFields);

    // Import file ref
    const importRef = React.useRef<HTMLInputElement>(null);

    // ─── Keyboard Shortcuts ─────────────────────────────────────
    const baseShortcuts: ShortcutDef[] = useMemo(() => {
        const shortcuts: ShortcutDef[] = [];

        if (onSave) {
            shortcuts.push({
                key: 's', ctrl: true, label: 'Ctrl+S',
                description: 'Save configuration',
                action: onSave,
            });
        }

        if (onReload) {
            shortcuts.push({
                key: 'r', ctrl: true, label: 'Ctrl+R',
                description: 'Reload data',
                action: onReload,
            });
        }

        if (showUndo && undoStack.canUndo) {
            shortcuts.push({
                key: 'z', ctrl: true, label: 'Ctrl+Z',
                description: 'Undo last change',
                action: () => undoStack.undo(),
            });
        }

        if (showExport) {
            shortcuts.push({
                key: 'e', ctrl: true, label: 'Ctrl+E',
                description: 'Export configuration',
                action: exportJSON,
            });
        }

        return [...shortcuts, ...extraShortcuts];
    }, [onSave, onReload, showUndo, undoStack, showExport, exportJSON, extraShortcuts]);

    const { showOverlay, setShowOverlay, shortcuts } = useKeyboardShortcuts(
        baseShortcuts, [onSave, onReload, undoStack.canUndo]
    );

    // ─── Toolbar State ──────────────────────────────────────────
    const [showToolbar, setShowToolbar] = useState(true);

    // ─── Render ─────────────────────────────────────────────────
    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* ═══ HEADER ═══ */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div
                        className="page-header-icon bg-app-primary"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                    >
                        {icon}
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                {subtitle}
                            </p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <DraftIndicator savedAt={draftSavedAt} />
                            {lastModifiedBy && (
                                <span className="text-[8px] text-app-muted-foreground/60">
                                    Last modified by <span className="font-bold text-app-muted-foreground">{lastModifiedBy}</span>
                                    {lastModifiedAt && (
                                        <> · {new Date(lastModifiedAt).toLocaleDateString()} {new Date(lastModifiedAt).toLocaleTimeString()}</>
                                    )}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {onReload && (
                        <button
                            type="button"
                            onClick={onReload}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                            title="Reload (Ctrl+R)"
                        >
                            <Settings2 size={9} /> Reload
                        </button>
                    )}
                    {onSave && (
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={saving || !hasChanges}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-app-primary text-white text-[9px] font-bold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Save (Ctrl+S)"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                        >
                            {saving ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />}
                            {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
                        </button>
                    )}
                </div>
            </div>

            {/* ═══ TOOLBAR ═══ */}
            <div className="rounded-xl border border-app-border/40 bg-app-surface/50 backdrop-blur-sm px-3 py-2 space-y-1.5">
                {/* Row 1: Core tools */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Undo */}
                    {showUndo && (
                        <UndoButton
                            canUndo={undoStack.canUndo}
                            depth={undoStack.depth}
                            onUndo={() => undoStack.undo()}
                        />
                    )}

                    {/* Export */}
                    {showExport && (
                        <>
                            <button
                                type="button"
                                onClick={exportJSON}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                                title="Export JSON (Ctrl+E)"
                            >
                                <Download size={9} /> Export
                            </button>
                            <button
                                type="button"
                                onClick={() => importRef.current?.click()}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                                title="Import JSON"
                            >
                                <Upload size={9} /> Import
                            </button>
                            <input ref={importRef} type="file" accept=".json" className="hidden" />
                            <button
                                type="button"
                                onClick={async () => {
                                    const ok = await copyToClipboard();
                                    if (ok) {
                                        const el = document.activeElement as HTMLElement;
                                        el?.blur();
                                    }
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                                title="Copy config to clipboard"
                            >
                                <Copy size={9} /> Copy
                            </button>
                        </>
                    )}

                    {/* Print */}
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                        title="Print page"
                    >
                        <Printer size={9} /> Print
                    </button>

                    {/* Keyboard shortcuts */}
                    <button
                        type="button"
                        onClick={() => setShowOverlay(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                        title="Keyboard shortcuts (?)"
                    >
                        <span className="text-[9px] font-mono">?</span>
                    </button>

                    {/* Expand/Collapse toggle */}
                    {sectionIds.length > 0 && (
                        <button
                            type="button"
                            onClick={toggleAll}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                            title={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
                        >
                            {allCollapsed ? <ChevronDown size={9} /> : <ChevronUp size={9} />}
                            {allCollapsed ? 'Expand' : 'Collapse'}
                        </button>
                    )}

                    {/* Extra toolbar items */}
                    {extraToolbarItems}
                </div>

                {/* Row 2: Search + Completeness */}
                {(showSearch && searchableFields.length > 0) || (showCompleteness && completenessScore >= 0) ? (
                    <div className="flex items-center gap-2 flex-wrap">
                        {showSearch && searchableFields.length > 0 && (
                            <div className="flex items-center gap-1 ml-auto">
                                <FieldSearchBar
                                    value={search}
                                    onChange={setSearch}
                                />
                                {search.trim() && (
                                    <span className="text-[8px] text-app-muted-foreground/50">
                                        {matchCount} match{matchCount !== 1 ? 'es' : ''}
                                    </span>
                                )}
                            </div>
                        )}
                        {showCompleteness && completenessScore >= 0 && (
                            <CompletenessMeter score={completenessScore} />
                        )}
                    </div>
                ) : null}
            </div>

            {/* ═══ CONTENT ═══ */}
            <div>
                {children}
            </div>

            {/* ═══ MODALS ═══ */}
            {showOverlay && (
                <KeyboardShortcutsModal
                    shortcuts={shortcuts}
                    onClose={() => setShowOverlay(false)}
                />
            )}
        </div>
    );
}
