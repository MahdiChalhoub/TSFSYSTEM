import { erpFetch } from "@/lib/erp-api";
import { CategoriesClient } from "./CategoriesClient";

export const dynamic = 'force-dynamic';

async function getCategoriesData() {
    try {
        const response = await erpFetch('categories/');
        // Handle both array and paginated { results: [...] } responses
        const categories = Array.isArray(response) ? response : (response?.results ?? []);
        return categories;
    } catch (e) {
        console.error("[CATEGORIES PAGE] FAILED:", e);
        return [];
    }
}

export default async function CategoriesPage() {
    const flatCategories = await getCategoriesData();
    return <CategoriesClient initialCategories={flatCategories} />;
}