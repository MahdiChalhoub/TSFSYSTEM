import ThemeSelector from '@/app/(privileged)/workspace/portal-config/ThemeSelector';
import { getCurrentPortalConfig } from '@/app/actions/client-portal';

export default async function EcommerceThemesPage() {
    let configId = '';
    let currentTheme = 'midnight';

    try {
        const config = await getCurrentPortalConfig();
        if (config) {
            configId = String(config.id);
            currentTheme = config.storefront_theme || 'midnight';
        }
    } catch {
        // fallback defaults
    }

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Theme Manager</h1>
                <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Choose the look and feel of your customer-facing storefront.</p>
            </div>

            <ThemeSelector configId={configId} currentTheme={currentTheme} />
        </div>
    );
}
