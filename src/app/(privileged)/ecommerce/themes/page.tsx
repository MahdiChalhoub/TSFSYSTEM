import { getCurrentPortalConfig } from '@/app/actions/client-portal';
import ThemeSelector from '@/app/(privileged)/workspace/portal-config/ThemeSelector';
import StoreTypePicker from './StoreTypePicker';
import StockModePicker from './StockModePicker';
import SectionBuilder from './SectionBuilder';
import { Palette } from 'lucide-react';

export default async function EcommerceThemesPage() {
 let config: any = null;
 let configId = '';
 let currentTheme = 'midnight';
 let currentType = 'PRODUCT_STORE';
 let currentStockMode = 'STRICT';
 let error: string | null = null;

 try {
 config = await getCurrentPortalConfig();
 if (config) {
 configId = String(config.id);
 currentTheme = config.storefront_theme || 'midnight';
 currentType = config.storefront_type || 'PRODUCT_STORE';
 currentStockMode = config.inventory_check_mode || 'STRICT';
 } else {
 error = "No active organization configuration found. Please select an organization from the header.";
 }
 } catch (err) {
 error = "Failed to load storefront configuration. The backend service might be restarting.";
 }

 if (error) {
 return (
 <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center">
 <div className="w-20 h-20 bg-amber-100 rounded-[2rem] flex items-center justify-center text-amber-600 mb-6">
 <Palette size={40} />
 </div>
 <h2 className="text-2xl font-black text-app-text tracking-tight">Configuration Unavailable</h2>
 <p className="text-app-text-muted mt-4 max-w-md mx-auto font-medium">
 {error}
 </p>
 <div className="mt-8 p-4 bg-app-bg rounded-2xl border border-app-border text-xs font-mono text-app-text-faint">
 Path: /ecommerce/themes
 </div>
 </div>
 );
 }

 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
 <Palette size={28} className="text-white" />
 </div>
 Theme <span className="text-violet-600">Manager</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Storefront Type & Visual Identity</p>
 </header>

 {/* Step 1: Store Type */}
 <StoreTypePicker configId={configId} currentType={currentType} />

 {/* Step 2: Inventory Behavioral Logic */}
 <div className="mt-8">
 <StockModePicker configId={configId} currentMode={currentStockMode} />
 </div>

 {/* Step 3: Visual Theme */}
 <div className="mt-8">
 <ThemeSelector configId={configId} currentTheme={currentTheme} />
 </div>

 {/* Step 4: Page Layout */}
 <div className="mt-8 pb-12">
 <SectionBuilder
 configId={configId}
 initialLayout={config?.layout}
 />
 </div>
 </div>
 );
}
