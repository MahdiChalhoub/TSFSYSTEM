import { erpFetch } from "@/lib/erp-api";
import { CategoriesGateway } from "./CategoriesGateway";

export const dynamic = 'force-dynamic';

async function getCategoriesData() {
    try {
        // 60s tagged cache — every page nav was hitting Django uncached
        // (700-1000ms TTFB). Mutating actions (create / update / delete /
        // link-brand / link-attribute) call revalidateTag('categories') so
        // counts stay fresh after writes; the 60s window only affects
        // counts when *another* tab/user makes the change.
        const response = await erpFetch('categories/with_counts/', {
            next: { revalidate: 60, tags: ['categories'] },
        } as any);
        const categories = Array.isArray(response) ? response : (response?.results ?? []);
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