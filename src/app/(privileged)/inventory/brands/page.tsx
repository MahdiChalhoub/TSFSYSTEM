import { Award } from 'lucide-react'
import { erpFetch } from "@/lib/erp-api";
import { BrandsClient } from "./BrandsClient";

export const dynamic = 'force-dynamic';

async function getBrandsData() {
 try {
 const brands = await erpFetch('inventory/brands/');
 const data = (brands as any);
 return Array.isArray(data) ? data : data?.results || [];
 } catch {
 return [];
 }
}

async function getCountriesData() {
 try {
 const countries = await erpFetch('countries/');
 const data = (countries as any);
 return Array.isArray(data) ? data : data?.results || [];
 } catch {
 return [];
 }
}

async function getCategoriesData() {
 try {
 const categories = await erpFetch('inventory/categories/with_counts/');
 const data = (categories as any);
 return Array.isArray(data) ? data : data?.results || [];
 } catch {
 return [];
 }
}

export default async function BrandsPage() {
 const [brands, countries, categories] = await Promise.all([
 getBrandsData(),
 getCountriesData(),
 getCategoriesData()
 ]);

 return (
    <div className="app-page space-y-6 p-6">
      <header className="flex items-center gap-4 mb-4 fade-in-up">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-primary)20', border: '1px solid var(--app-primary)40' }}>
          <Award size={26} style={{ color: 'var(--app-primary)' }} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Product brands and manufacturers</p>
          <h1 className="text-3xl font-black tracking-tight text-app-foreground">Brands</h1>
        </div>
      </header>
      <BrandsClient
 initialBrands={brands}
 countries={countries}
 categories={categories}
 />
 
    </div>
  )
}