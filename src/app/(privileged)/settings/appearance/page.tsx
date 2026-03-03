import { Paintbrush } from 'lucide-react';
import { getOrgDefaultTheme } from '@/app/actions/settings/theme';
import { OrgThemeSettings } from './OrgThemeSettings';

export const metadata = {
 title: 'Appearance Settings — TSFSYSTEM',
};

export default async function AppearancePage() {
 const orgDefaultTheme = await getOrgDefaultTheme();

 return (
 <div className="page-container">
 {/* Header */}
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Palette size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Settings</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Appearance <span className="text-app-primary">& Themes</span>
          </h1>
        </div>
      </div>
    </header>

 {/* Org default theme panel */}
 <OrgThemeSettings currentOrgDefault={orgDefaultTheme} />
 </div>
 );
}
