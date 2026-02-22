import { getCurrentPortalConfig } from '@/app/actions/client-portal';
import ThemeSelector from '@/app/(privileged)/workspace/portal-config/ThemeSelector';
import StoreTypePicker from './StoreTypePicker';
import { Palette } from 'lucide-react';

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
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header>
                <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
                        <Palette size={28} className="text-white" />
                    </div>
                    Theme <span className="text-violet-600">Manager</span>
                </h1>
                <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Storefront Type & Visual Identity</p>
            </header>

            {/* Step 1: Store Type */}
            <StoreTypePicker configId={configId} currentType={currentType} />

            {/* Step 2: Visual Theme */}
            <div className="mt-8">
                <ThemeSelector configId={configId} currentTheme={currentTheme} />
            </div>
        </div>
    );
}

