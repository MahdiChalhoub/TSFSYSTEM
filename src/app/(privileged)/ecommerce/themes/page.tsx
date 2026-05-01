import { getCurrentPortalConfig } from '@/app/actions/client-portal';
import ThemeSelector from '@/app/(privileged)/workspace/portal-config/ThemeSelector';
import StoreTypePicker from './StoreTypePicker';

export default async function EcommerceThemesPage() {
    let configId = '';
    let currentTheme = 'midnight';
    let currentType = 'PRODUCT_STORE';

    try {
        const config = await getCurrentPortalConfig();
        if (config) {
            configId = String(config.id);
            currentTheme = config.storefront_theme || 'midnight';
            currentType = config.storefront_type || 'PRODUCT_STORE';
        }
    } catch {
        // fallback defaults
    }

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Theme Manager</h1>
                <p style={{ color: 'var(--app-muted-foreground)', marginTop: '0.25rem' }}>Choose the type of storefront and the visual theme for your customers.</p>
            </div>

            {/* Step 1: Store Type */}
            <StoreTypePicker configId={configId} currentType={currentType} />

            {/* Step 2: Visual Theme */}
            <div style={{ marginTop: '2rem' }}>
                <ThemeSelector configId={configId} currentTheme={currentTheme} />
            </div>
        </div>
    );
}
