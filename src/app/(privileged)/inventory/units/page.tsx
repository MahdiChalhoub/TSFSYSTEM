import { Ruler } from 'lucide-react'
import { erpFetch } from "@/lib/erp-api";
import UnitsClient from "./UnitsClient";
import { getTranslation } from '@/lib/server-translation';

export const dynamic = 'force-dynamic';

async function getUnitsData() {
  try {
    const units = await erpFetch('inventory/units/');
    return (Array.isArray(units) ? units : units?.results ?? []);
  } catch (e) {
    console.error("Failed to fetch units:", e);
    return [];
  }
}

export default async function UnitsPage() {
  const units = await getUnitsData();
  const { t } = await getTranslation();

  return (
    <div className="app-page space-y-6 p-6">
      <header className="flex items-center gap-4 fade-in-up">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-info)20', border: '1px solid var(--app-info)40' }}>
          <Ruler size={26} style={{ color: 'var(--app-info)' }} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">{t('inventory.title')}</p>
          <h1 className="text-3xl font-black tracking-tight text-app-foreground">{t('inventory.units')}</h1>
          <p className="text-sm text-app-muted-foreground mt-0.5">{t('inventory.units_subtitle')}</p>
        </div>
      </header>
      <UnitsClient initialUnits={units} />
    </div>
  )
}
