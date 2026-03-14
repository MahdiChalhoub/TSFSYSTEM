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
    <div className="flex flex-col h-full p-4 md:p-6">
      <CategoriesClient initialCategories={categories} />
    </div>
  )
}
