import { erpFetch } from "@/lib/erp-api";
import { CategoriesGateway } from "./CategoriesGateway";

export const dynamic = 'force-dynamic';

async function getCategoriesData() {
    try {
        // Flat route 'categories/' now correctly hits inventory's CategoryViewSet
        // (workspace's TaskCategoryViewSet was renamed to 'task-categories/')
        const response = await erpFetch('categories/with_counts/');
        const categories = Array.isArray(response) ? response : (response?.results ?? []);
        console.log('[CATEGORIES PAGE] Loaded', categories.length, 'categories');
        return categories;
    } catch (e) {
        console.error("[CATEGORIES PAGE] FAILED:", e);
        return [];
    }
}

export default async function CategoriesPage() {
    const flatCategories = await getCategoriesData();
    return <CategoriesGateway initialCategories={flatCategories} />;
}