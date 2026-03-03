/** Client Pricing Engine — Price Groups & Rules */
import { erpFetch } from "@/lib/erp-api";
import PricingManager from "./manager";
import { Tag, DollarSign, Users, Layers } from "lucide-react";

export const dynamic = 'force-dynamic';

async function getPriceGroups() {
 try {
 return await erpFetch('price-groups/');
 } catch (e) {
 console.error("Failed to fetch price groups", e);
 return [];
 }
}

async function getPriceRules() {
 try {
 return await erpFetch('price-rules/');
 } catch (e) {
 console.error("Failed to fetch price rules", e);
 return [];
 }
}

async function getContacts() {
 try {
 return await erpFetch('crm/contacts/');
 } catch (e) {
 return [];
 }
}

async function getProducts() {
 try {
 return await erpFetch('inventory/products/');
 } catch (e) {
 return [];
 }
}

async function getCategories() {
 try {
 return await erpFetch('inventory/categories/');
 } catch (e) {
 return [];
 }
}

export default async function PricingPage() {
 const [priceGroups, priceRules, contacts, products, categories] = await Promise.all([
 getPriceGroups(),
 getPriceRules(),
 getContacts(),
 getProducts(),
 getCategories(),
 ]);

 return (
 <div className="app-page space-y-6 animate-in fade-in duration-500">
 <div className="max-w-[1600px] mx-auto space-y-12">
 {/* Header */}
 <div className="flex flex-col md:flex-row justify-between items-end gap-6">
 <div>
 <div className="flex items-center gap-3 mb-4">
 <div className="w-14 h-14 rounded-2xl bg-app-primary flex items-center justify-center text-app-foreground shadow-lg shadow-violet-200">
 <Tag size={28} />
 </div>
 <span className="text-xs font-black text-app-primary uppercase tracking-[0.3em]">Revenue Optimization</span>
 </div>
 <h1 className="text-5xl lg:text-7xl font-black text-app-foreground tracking-tighter leading-none">
 Client <span className="text-app-primary">Pricing</span>
 </h1>
 <p className="mt-6 text-app-muted-foreground font-medium max-w-2xl text-lg leading-relaxed">
 Configure price groups, client tiers, and custom price rules.
 Assign contacts to groups for automatic pricing during sales.
 </p>
 </div>

 <div className="flex flex-col sm:flex-row gap-6 bg-app-surface p-8 rounded-[40px] shadow-2xl shadow-violet-900/5 border border-app-border">
 <div className="text-center px-6 border-r border-app-border last:border-0">
 <div className="text-4xl font-black text-app-foreground tracking-tighter mb-1">{priceGroups.length}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Price Groups</div>
 </div>
 <div className="text-center px-6 border-r border-app-border last:border-0">
 <div className="text-4xl font-black text-app-foreground tracking-tighter mb-1">{priceRules.length}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Active Rules</div>
 </div>
 </div>
 </div>

 {/* Feature Cards */}
 <div className="bg-app-primary rounded-[50px] p-10 lg:p-16 relative overflow-hidden shadow-2xl shadow-violet-200">
 <div className="absolute top-0 right-0 w-96 h-96 bg-app-surface opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
 <div className="absolute bottom-0 left-0 w-64 h-64 bg-app-background opacity-5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

 <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12">
 <div className="space-y-4">
 <div className="w-12 h-12 rounded-2xl bg-app-foreground/10 flex items-center justify-center text-app-foreground">
 <Users size={24} />
 </div>
 <h4 className="text-xl font-black text-app-foreground">Group Pricing</h4>
 <p className="text-violet-100 text-sm font-medium leading-relaxed">
 Assign contacts to price groups (VIP, Wholesale, Seasonal) for automatic bulk pricing.
 </p>
 </div>
 <div className="space-y-4">
 <div className="w-12 h-12 rounded-2xl bg-app-foreground/10 flex items-center justify-center text-app-foreground">
 <DollarSign size={24} />
 </div>
 <h4 className="text-xl font-black text-app-foreground">Flexible Rules</h4>
 <p className="text-violet-100 text-sm font-medium leading-relaxed">
 Fixed price, percentage discount, or amount off — per product, category, or globally.
 </p>
 </div>
 <div className="space-y-4">
 <div className="w-12 h-12 rounded-2xl bg-app-foreground/10 flex items-center justify-center text-app-foreground">
 <Layers size={24} />
 </div>
 <h4 className="text-xl font-black text-app-foreground">Priority Cascade</h4>
 <p className="text-violet-100 text-sm font-medium leading-relaxed">
 When multiple rules apply, the highest-priority group wins. Direct contact rules always take precedence.
 </p>
 </div>
 </div>
 </div>

 <PricingManager
 priceGroups={priceGroups}
 priceRules={priceRules}
 contacts={contacts}
 products={products}
 categories={categories}
 />
 </div>
 </div>
 );
}
