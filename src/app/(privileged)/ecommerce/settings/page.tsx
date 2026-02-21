import { getCurrentPortalConfig } from '@/app/actions/client-portal';
import EcommerceSettingsClient from './client';

export default async function EcommerceSettingsPage() {
    let config: any = null;

    try {
        config = await getCurrentPortalConfig();
    } catch {
        // fallback
    }

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Storefront Settings</h1>
                <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Configure your eCommerce storefront behavior and appearance.</p>
            </div>

            <EcommerceSettingsClient config={config} />
        </div>
    );
}
