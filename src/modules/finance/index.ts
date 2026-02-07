/**
 * Finance Module — Frontend Entry Point
 * 
 * Re-exports all finance-related components from their current locations.
 * Module consumers should import from '@/modules/finance' instead of 
 * directly referencing '@/components/finance/'.
 */
export { default as ChartOfAccountPicker } from '@/components/finance/chart-of-account-picker';
export { default as ContactPicker } from '@/components/finance/contact-picker';
export { default as FinanceAccountSelector } from '@/components/finance/finance-account-selector';
export { default as PostEventButton } from '@/components/finance/post-event-button';
