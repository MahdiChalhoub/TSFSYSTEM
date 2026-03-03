import { FolderOpen } from 'lucide-react'
import { erpFetch } from "@/lib/erp-api";
import { CategoriesClient } from "./CategoriesClient";

export const dynamic = 'force-dynamic';

async function getCategoriesData() {
  try {
    const categories = await erpFetch('inventory/categories/with_counts/');
    return (Array.isArray(categories) ? categories : categories?.results ?? []);
  } catch (err) {
    console.error("Failed to fetch categories:", err);
    return [];
  }
}

export default async function CategoriesPage() {
  const categories = await getCategoriesData();

  return (
    <div className="app-page space-y-6 p-6">
      <header className="flex items-center gap-4 fade-in-up">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-info)20', border: '1px solid var(--app-info)40' }}>
          <FolderOpen size={26} style={{ color: 'var(--app-info)' }} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Inventory</p>
          <h1 className="text-3xl font-black tracking-tight text-app-foreground">Categories</h1>
          <p className="text-sm text-app-muted-foreground mt-0.5">Product category hierarchy</p>
        </div>
      </header>
      <CategoriesClient initialCategories={categories} />
    </div>
  )
}
