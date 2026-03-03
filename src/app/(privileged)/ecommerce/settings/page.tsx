import { getCurrentPortalConfig } from '@/app/actions/client-portal';
import EcommerceSettingsClient from './client';
import { Settings } from 'lucide-react';

export default async function EcommerceSettingsPage() {
 let config: any = null;

 try {
 config = await getCurrentPortalConfig();
 } catch {
 // fallback
 }

 return (
 <div className="app-page p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header>
 <h1 className="page-header-title tracking-tighter text-app-foreground flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-app-info flex items-center justify-center shadow-lg shadow-blue-200">
 <Settings size={28} className="text-app-foreground" />
 </div>
 Storefront <span className="text-app-info">Settings</span>
 </h1>
 <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Configure eCommerce Behavior & Appearance</p>
 </header>

 <EcommerceSettingsClient config={config} />
 </div>
 );
}

