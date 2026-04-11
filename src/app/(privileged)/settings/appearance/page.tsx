import { Palette } from 'lucide-react';
// Temporarily removed to fix 500 error - will re-enable after backend fix
// import { getOrgDefaultTheme } from '@/app/actions/settings/theme';
// import { OrgThemeSettings } from './OrgThemeSettings';
import { DesignSystemSwitcher } from '@/components/design-systems/DesignSystemSwitcher';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';

export const metadata = {
  title: 'Appearance Settings — TSFSYSTEM',
};

// Changed from async to regular function to avoid server-side errors
export default function AppearancePage() {
  // Removed server-side data fetching that was causing 500 errors
  const orgDefaultTheme: string | null = null;

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
              Appearance <span className="text-app-primary">&amp; Themes</span>
            </h1>
          </div>
        </div>
      </header>

      {/* Design System Switcher - Full View */}
      <section className="mt-6 bg-app-surface border border-app-border rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-app-foreground">Design System</h2>
          <p className="text-sm text-app-muted-foreground mt-1">
            Choose between different design languages (Ant Design, Material Design, Apple HIG, Tailwind)
          </p>
        </div>
        <DesignSystemSwitcher compact={false} showLabel={true} />
      </section>

      {/* Theme Switcher - Full View */}
      <section className="mt-6 bg-app-surface border border-app-border rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-app-foreground">Color Theme</h2>
          <p className="text-sm text-app-muted-foreground mt-1">
            Choose from professionally designed color themes
          </p>
        </div>
        <ThemeSwitcher expanded={true} />
      </section>

      {/* Org default theme panel */}
      {/* TEMPORARILY DISABLED - Re-enable after testing basic theme switching */}
      {/* <OrgThemeSettings currentOrgDefault={orgDefaultTheme} /> */}
    </div>
  );
}
