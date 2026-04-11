/**
 * TSFSYSTEM Settings Framework
 * ═══════════════════════════════════════════════════════════
 * A comprehensive library of 41 reusable hooks, components,
 * and utilities for building enterprise-grade settings pages.
 *
 * Usage:
 *   import { useCollapsibleSections, ValidationDot, CompletenessMeter } from '@/lib/settings-framework';
 * ═══════════════════════════════════════════════════════════
 */

// ─── Hooks ───────────────────────────────────────────────
export { useCollapsibleSections } from './hooks/useCollapsibleSections';
export { useFieldLocking } from './hooks/useFieldLocking';
export { useAutoSaveDraft } from './hooks/useAutoSaveDraft';
export { useUndoStack } from './hooks/useUndoStack';
export type { UndoEntry } from './hooks/useUndoStack';
export { useConfigDiff } from './hooks/useConfigDiff';
export type { DiffEntry } from './hooks/useConfigDiff';
export { useFieldValidation } from './hooks/useFieldValidation';
export type { FieldStatus, ValidationRule } from './hooks/useFieldValidation';
export { useConfigTemplates } from './hooks/useConfigTemplates';
export type { ConfigTemplate } from './hooks/useConfigTemplates';
export { useConfigHistory } from './hooks/useConfigHistory';
export { useConfigExport } from './hooks/useConfigExport';
export { useConfigSearch } from './hooks/useConfigSearch';
export type { SearchableField } from './hooks/useConfigSearch';
export { usePresenceTracking } from './hooks/usePresenceTracking';
export type { ActiveEditor } from './hooks/usePresenceTracking';
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
export type { ShortcutDef } from './hooks/useKeyboardShortcuts';
export { useDragAndDrop } from './hooks/useDragAndDrop';
export { useRBAC } from './hooks/useRBAC';
export type { UserRole } from './hooks/useRBAC';

// ─── Components ──────────────────────────────────────────
export { ValidationDot } from './components/ValidationDot';
export { DefaultValueHint } from './components/DefaultValueHint';
export { FieldSearchBar } from './components/FieldSearchBar';
export { PresetSelector } from './components/PresetSelector';
export type { Preset } from './components/PresetSelector';
export { CompletenessMeter } from './components/CompletenessMeter';
export { ConfigDiffModal } from './components/ConfigDiffModal';
export { FieldLockToggle } from './components/FieldLockToggle';
export { DraftIndicator } from './components/DraftIndicator';
export { FieldHelp } from './components/FieldHelp';
export { CollapsibleCard } from './components/CollapsibleCard';
export { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
export { UndoButton } from './components/UndoButton';
export { SettingsPageShell } from './components/SettingsPageShell';
export type { SettingsPageShellProps } from './components/SettingsPageShell';

// ─── Utilities ───────────────────────────────────────────
export { calculateHealthScore } from './utils/healthScoreCalculator';
export type { HealthCategory } from './utils/healthScoreCalculator';
export { createFieldRegistry } from './utils/fieldMetadata';
export type { FieldMeta } from './utils/fieldMetadata';
export { resetSectionFields, calculateCompleteness } from './utils/sectionDefinitions';
export type { SectionDefinition } from './utils/sectionDefinitions';
