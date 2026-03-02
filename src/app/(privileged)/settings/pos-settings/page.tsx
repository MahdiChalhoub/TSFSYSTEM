import { redirect } from 'next/navigation';

// Canonical POS Settings live at /sales/pos-settings
// This page is kept for backwards compatibility with old links/bookmarks
export default function POSSettingsRedirect() {
 redirect('/sales/pos-settings');
}
