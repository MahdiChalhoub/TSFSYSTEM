import { erpFetch } from "@/lib/erp-api";
import { CategoryTree } from "@/components/admin/categories/CategoryTree";
import { CreateCategoryButton } from "@/components/admin/categories/CreateCategoryButton";
import { Wrench } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getCategoriesData() {
    // erpFetch returns raw array for standard ViewSet list, but we implemented 'with_counts'
    // which returns the enriched list.
    const categories = await erpFetch('categories/with_counts/');

    // Build Tree (Client-side logic moved here or kept? Logic is pure JS, can stay)
    const categoryMap = new Map();
    const roots: Record<string, any>[] = [];

    if (Array.isArray(categories)) {
        // Initialize Map with empty children array
        categories.forEach((c: Record<string, any>) => {
            categoryMap.set(c.id, {
                ...c,
                children: [],
                // Normalize counts
                product_count: c.product_count ?? c.productCount ?? 0,
                brand_count: c.brand_count ?? 0,
                parfum_count: c.parfum_count ?? 0,
            });
        });

        // Link Children to Parents
        // DRF sends FK as 'parent' (the field name on the model), value is the parent's PK
        categories.forEach((c: Record<string, any>) => {
            const node = categoryMap.get(c.id);
            const parentId = c.parent; // DRF FK field = model field name = 'parent'
            if (parentId) {
                const parent = categoryMap.get(parentId);
                if (parent) {
                    parent.children.push(node);
                } else {
                    roots.push(node); // Parent not in current org's data
                }
            } else {
                roots.push(node); // Root category (no parent)
            }
        });
    }

    return {
        hierarchicalCategories: JSON.parse(JSON.stringify(roots)),
        flatCategories: JSON.parse(JSON.stringify(categories))
    };
}

async function getOrgContext() {
    try {
        // Fetch all organizations (saas and user own)
        const orgs = await erpFetch('organizations/');
        // Find the one that matches our context, or just the first one if only one returned
        if (Array.isArray(orgs)) {
            return orgs[0];
        }
        return null;
    } catch {
        return null;
    }
}

export default async function CategoriesPage() {
    const [{ hierarchicalCategories, flatCategories }, orgContext] = await Promise.all([
        getCategoriesData(),
        getOrgContext()
    ]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Product Categories</h1>
                        {orgContext?.business_type_name && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 animate-in zoom-in duration-300">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Industry Vector</span>
                                <span className="text-sm font-bold">{orgContext.business_type_name}</span>
                            </div>
                        )}
                    </div>
                    <p className="text-gray-500 font-medium">Organize your inventory with a flexible category hierarchy.</p>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/inventory/maintenance?tab=category"
                        className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-emerald-600 px-4 py-3 rounded-xl font-semibold shadow-sm transition-all flex items-center gap-2"
                    >
                        <Wrench size={18} />
                        <span>Maintenance tool</span>
                    </Link>
                    <CreateCategoryButton potentialParents={flatCategories || []} />
                </div>
            </div>

            {/* Content */}
            <div className="card-premium p-6">
                {/* Tree Header */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-800">Category Structure</h3>
                    <input
                        type="text"
                        placeholder="Search categories..."
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 w-64 transition-all"
                    />
                </div>

                {hierarchicalCategories.length > 0 ? (
                    <CategoryTree categories={hierarchicalCategories} allCategories={flatCategories || []} />
                ) : (
                    <div className="py-12 text-center text-gray-400">
                        <p>No categories defined yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}