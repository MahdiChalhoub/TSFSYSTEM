import { getProductNamingRule } from '@/app/actions/settings';
import { NamingRuleEditor } from '@/components/admin/NamingRuleEditor';

export default async function InventorySettingsPanel() {
 const namingRule = await getProductNamingRule();

 return (
 <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-6">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
 <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
 </svg>
 </div>
 <div>
 <h2 className="text-xl font-semibold text-app-text">Product Naming Rule</h2>
 <p className="text-sm text-app-text-muted">Customize how product names are auto-generated</p>
 </div>
 </div>

 <NamingRuleEditor initialRule={namingRule} />
 </div>
 );
}