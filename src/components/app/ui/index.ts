/**
 * App UI Primitives — Barrel Export
 * ====================================
 * Import from here in rebuilt pages:
 *   import { AppCard, AppButton, AppBadge, AppPageHeader, AppKpiCard, AppKpiRow,
 *            AppDataTable, AppEmptyState, AppSection } from '@/components/app/ui';
 *
 * RULE: All rebuilt pages MUST use these primitives.
 * NO raw divs for cards, NO inline button styles, NO custom table markup.
 * This is what ensures visual consistency across all 5 themes.
 */

export { AppCard, AppSection } from './AppCard';
export { AppButton } from './AppButton';
export { AppBadge } from './AppBadge';
export { AppKpiCard, AppKpiRow } from './AppKpiCard';
export { AppDataTable } from './AppDataTable';
export type { AppTableColumn } from './AppDataTable';
export { AppEmptyState } from './AppEmptyState';
export { AppPageHeader } from './AppPageHeader';
