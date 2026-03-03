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
 <div className="app-page p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center">
 <div className="w-20 h-20 bg-app-warning-bg rounded-[2rem] flex items-center justify-center text-app-warning mb-6">
 <Palette size={40} />
 </div>
 <h2 className="text-2xl font-black text-app-foreground tracking-tight">Configuration Unavailable</h2>
 <p className="text-app-muted-foreground mt-4 max-w-md mx-auto font-medium">
 {error}
 </p>
 <div className="mt-8 p-4 bg-app-background rounded-2xl border border-app-border text-xs font-mono text-app-muted-foreground">
 Path: /ecommerce/themes
 </div>
 </div>
 );
 }

 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Palette size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">eCommerce</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Store <span className="text-app-primary">Themes</span>
          </h1>
        </div>
      </div>
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
