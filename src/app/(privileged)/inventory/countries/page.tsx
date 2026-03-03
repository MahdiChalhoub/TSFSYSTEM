import { Globe } from 'lucide-react'
// @ts-nocheck
import { erpFetch } from "@/lib/erp-api";
import { CountriesClient } from "./CountriesClient";

export const dynamic = 'force-dynamic';

async function getCountriesData() {
  try {
    const countries = await erpFetch('countries/');
    return (Array.isArray(countries) ? countries : countries?.results ?? []);
  } catch (err) {
    console.error("Failed to fetch countries:", err);
    return [];
  }
}

export default async function CountriesPage() {
  const countries = await getCountriesData();

  return (
    <div className="app-page space-y-6 p-6">
      <header className="flex items-center gap-4 fade-in-up">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-muted-foreground)20', border: '1px solid var(--app-muted-foreground)40' }}>
          <Globe size={26} style={{ color: 'var(--app-muted-foreground)' }} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Inventory</p>
          <h1 className="text-3xl font-black tracking-tight text-app-foreground">Countries</h1>
          <p className="text-sm text-app-muted-foreground mt-0.5">Country and region management</p>
        </div>
      </header>
      <CountriesClient initialCountries={countries} />
    </div>
  )
}
