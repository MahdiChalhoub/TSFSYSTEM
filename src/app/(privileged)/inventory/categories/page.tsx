import { erpFetch } from "@/lib/erp-api";
import { CategoriesClient } from "./CategoriesClient";

export const dynamic = 'force-dynamic';

async function getCategoriesData() {
 try {
 // Fetch enriched categories with counts
 const categories = await erpFetch('inventory/categories/with_counts/');
 return (categories as any[]) || [];
 } catch (err) {
 console.error("Failed to fetch categories:", err);
 return [];
 }
}

export default async function CategoriesPage() {
 const categories = await getCategoriesData();

 return (
 <CategoriesClient initialCategories={categories} />
 );
}