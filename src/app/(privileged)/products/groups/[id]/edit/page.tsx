import { erpFetch } from "@/lib/erp-api";
import { GroupedProductForm } from "@/components/admin/GroupedProductForm";
import { notFound } from "next/navigation";
import { Box } from "lucide-react";
import AttachmentManager from "@/components/common/AttachmentManager";

export const dynamic = 'force-dynamic';

async function getData(groupId: number) {
 try {
 const [group, brands, categories, units, countries] = await Promise.all([
 erpFetch(`product-groups/${groupId}/`),
 erpFetch('brands/'),
 erpFetch('inventory/categories/'),
 erpFetch('units/'),
 erpFetch('countries/')
 ]);

 if (!group) return null;

 return {
 initialGroup: group,
 brands,
 categories,
 units,
 countries
 };
 } catch (e) {
 console.error("Failed to fetch product group edit data:", e);
 return null;
 }
}

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 const data = await getData(Number(id));

 if (!data) {
 notFound();
 }

 return (
 <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in">
 <div>
 <h1 className="page-header-title ">Edit Product Family</h1>
 <p className="text-app-text-muted">Update the Parfum/Group details or add new variants.</p>
 </div>

 <GroupedProductForm {...data} />

 <div className="bg-app-surface p-8 rounded-[2rem] border border-app-border shadow-sm mt-12 overflow-hidden">
 <h2 className="text-xl font-bold text-app-text mb-6 flex items-center gap-2 tracking-tighter">
 <Box className="text-emerald-600" size={24} />
 Family Digital Assets
 </h2>
 <AttachmentManager
 linkedModel="inventory.ProductGroup"
 linkedId={Number(id)}
 category="PRODUCT_IMAGE"
 />
 </div>
 </div>
 );
}