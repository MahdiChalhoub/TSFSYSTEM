'use client';
import React, { useMemo, ReactNode } from 'react';
import {
    Save, Loader2, Download, Upload, Copy,
    Printer, HelpCircle, MoreHorizontal, RefreshCcw, Undo2,
    Maximize2, Minimize2, Check,
} from 'lucide-react';
import { useKeyboardShortcuts, type ShortcutDef } from '../hooks/useKeyboardShortcuts';
import { useAutoSaveDraft } from '../hooks/useAutoSaveDraft';
import { useUndoStack } from '../hooks/useUndoStack';
import { useConfigExport } from '../hooks/useConfigExport';
import { useCollapsibleSections } from '../hooks/useCollapsibleSections';
import { useFieldLocking } from '../hooks/useFieldLocking';
import { useConfigSearch } from '../hooks/useConfigSearch';
import { FieldSearchBar } from './FieldSearchBar';
import { CompletenessMeter } from './CompletenessMeter';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

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

    // ─── Save state ─────────────────────────────────────────────
    const saveState: 'idle' | 'dirty' | 'saving' = saving ? 'saving' : (hasChanges ? 'dirty' : 'idle');

    // ─── Render — single-row chrome, contextual actions ─────────
    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
            {/* ═══ HEADER — one row: title block + status + actions ═══ */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* LEFT: icon + title + meta inline */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                        className="page-header-icon bg-app-primary"
                        style={{
                            boxShadow:
                                '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        }}
                    >
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <h1 className="truncate">
                            {title}
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap text-tp-xxs leading-none">
                            {subtitle && (
                                <span className="font-bold uppercase tracking-wide text-app-muted-foreground truncate">
                                    {subtitle}
                                </span>
                            )}
                            {/* ONE status piece at a time — never stacked */}
                            <StatusPill state={saveState} draftSavedAt={draftSavedAt} />
                            {/* Editor — only if no save state to show, OR alongside the saved state */}
                            {saveState === 'idle' && lastModifiedBy && (
                                <span className="text-app-muted-foreground/70 truncate">
                                    by{' '}
                                    <span className="font-bold text-app-foreground/80">{lastModifiedBy}</span>
                                    {lastModifiedAt && (
                                        <span className="opacity-70">
                                            {' · '}
                                            {new Date(lastModifiedAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT: contextual actions only */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Undo — only when there's something to undo */}
                    {showUndo && undoStack.canUndo && (
                        <button
                            type="button"
                            onClick={() => undoStack.undo()}
                            title={`Undo last change (Ctrl+Z) — ${undoStack.depth} in stack`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-app-border text-tp-xs font-bold text-app-muted-foreground hover:bg-app-surface hover:text-app-foreground transition-all"
                        >
                            <Undo2 size={13} /> Undo
                            {undoStack.depth > 1 && (
                                <span className="ml-0.5 px-1 rounded text-[9px] font-mono tabular-nums bg-app-primary/15 text-app-primary font-black">
                                    {undoStack.depth}
                                </span>
                            )}
                        </button>
                    )}

                    {/* Save — only when there are changes or actively saving */}
                    {onSave && (saveState === 'dirty' || saveState === 'saving') && (
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={saving}
                            title={saving ? 'Saving…' : 'Save changes (Ctrl+S)'}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-app-primary text-white text-tp-xs font-bold transition-all hover:brightness-110 hover:-translate-y-px disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            style={{
                                boxShadow:
                                    '0 2px 10px color-mix(in srgb, var(--app-primary) 35%, transparent)',
                            }}
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={13} className="animate-spin" /> Saving…
                                </>
                            ) : (
                                <>
                                    <Save size={13} /> Save Changes
                                    <span className="hidden md:inline ml-0.5 px-1 py-0.5 rounded text-[9px] font-mono tabular-nums bg-white/20">
                                        ⌘S
                                    </span>
                                </>
                            )}
                        </button>
                    )}

                    {extraToolbarItems}

                    {/* Overflow — all rare actions tucked away */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                title="More actions"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-app-border text-app-muted-foreground hover:bg-app-surface hover:text-app-foreground transition-all"
                            >
                                <MoreHorizontal size={14} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {onReload && (
                                <>
                                    <MenuItem onClick={onReload} icon={<RefreshCcw size={13} />} label="Reload" shortcut="⌘R" />
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            {showExport && (
                                <>
                                    <MenuItem onClick={exportJSON} icon={<Download size={13} />} label="Export JSON" shortcut="⌘E" />
                                    <MenuItem
                                        onClick={() => importRef.current?.click()}
                                        icon={<Upload size={13} />}
                                        label="Import JSON"
                                    />
                                    <MenuItem
                                        onClick={async () => {
                                            const ok = await copyToClipboard();
                                            if (ok) (document.activeElement as HTMLElement)?.blur();
                                        }}
                                        icon={<Copy size={13} />}
                                        label="Copy to clipboard"
                                    />
                                    <input ref={importRef} type="file" accept=".json" className="hidden" />
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            <MenuItem onClick={() => window.print()} icon={<Printer size={13} />} label="Print" />
                            {sectionIds.length > 0 && (
                                <MenuItem
                                    onClick={toggleAll}
                                    icon={allCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                                    label={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
                                />
                            )}
                            <DropdownMenuSeparator />
                            <MenuItem
                                onClick={() => setShowOverlay(true)}
                                icon={<HelpCircle size={13} />}
                                label="Keyboard shortcuts"
                                shortcut="?"
                            />
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* ═══ SEARCH + COMPLETENESS — only render when relevant ═══ */}
            {((showSearch && searchableFields.length > 0) || (showCompleteness && completenessScore >= 0)) && (
                <div className="flex items-center gap-2 flex-wrap">
                    {showSearch && searchableFields.length > 0 && (
                        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                            <FieldSearchBar value={search} onChange={setSearch} />
                            {search.trim() && (
                                <span className="text-tp-xxs font-mono text-app-muted-foreground tabular-nums whitespace-nowrap">
                                    {matchCount} match{matchCount !== 1 ? 'es' : ''}
                                </span>
                            )}
                        </div>
                    )}
                    {showCompleteness && completenessScore >= 0 && (
                        <div className="ml-auto">
                            <CompletenessMeter score={completenessScore} />
                        </div>
                    )}
                </div>
            )}

            {/* ═══ CONTENT ═══ */}
            <div>{children}</div>

            {/* ═══ MODALS ═══ */}
            {showOverlay && (
                <KeyboardShortcutsModal shortcuts={shortcuts} onClose={() => setShowOverlay(false)} />
            )}
        </div>
    );
}

// ─── Status pill: ONE source of truth for save state ────────────

function StatusPill({
    state, draftSavedAt,
}: { state: 'idle' | 'dirty' | 'saving'; draftSavedAt: string | null }) {
    if (state === 'saving') {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-app-primary bg-app-primary/10 border border-app-primary/25 font-bold">
                <Loader2 size={9} className="animate-spin" /> Saving
            </span>
        );
    }
    if (state === 'dirty') {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-app-warning bg-app-warning/10 border border-app-warning/30 font-bold">
                <span className="w-1 h-1 rounded-full bg-app-warning animate-pulse" />
                Unsaved
            </span>
        );
    }
    if (draftSavedAt) {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-app-success bg-app-success/10 border border-app-success/25 font-bold">
                <Check size={9} strokeWidth={3} /> Saved · {draftSavedAt}
            </span>
        );
    }
    return null;
}

// ─── Dropdown menu item: icon + label + optional kbd shortcut ───

function MenuItem({
    onClick, icon, label, shortcut,
}: { onClick: () => void; icon: ReactNode; label: string; shortcut?: string }) {
    return (
        <DropdownMenuItem
            onClick={onClick}
            className="flex items-center gap-2 cursor-pointer"
        >
            <span className="text-app-muted-foreground">{icon}</span>
            <span className="flex-1 text-tp-sm">{label}</span>
            {shortcut && (
                <span className="text-[10px] font-mono text-app-muted-foreground tabular-nums opacity-60">
                    {shortcut}
                </span>
            )}
        </DropdownMenuItem>
    );
}

