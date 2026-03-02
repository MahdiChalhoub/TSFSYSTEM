'use client';

import { useState } from 'react';
import { saveProductNamingRule, type ProductNamingRule, type NamingRuleComponent } from '@/app/actions/settings';
import { ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';

export function NamingRuleEditor({ initialRule }: { initialRule: ProductNamingRule }) {
 const [rule, setRule] = useState(initialRule);
 const [isSaving, setIsSaving] = useState(false);
 const [message, setMessage] = useState('');

 const moveComponent = (index: number, direction: 'up' | 'down') => {
 const newComponents = [...rule.components];
 const targetIndex = direction === 'up' ? index - 1 : index + 1;

 if (targetIndex < 0 || targetIndex >= newComponents.length) return;

 [newComponents[index], newComponents[targetIndex]] = [newComponents[targetIndex], newComponents[index]];
 setRule({ ...rule, components: newComponents });
 };

 const toggleComponent = (index: number, field: 'enabled' | 'useShortName') => {
 const newComponents = [...rule.components];
 newComponents[index] = { ...newComponents[index], [field]: !newComponents[index][field] };
 setRule({ ...rule, components: newComponents });
 };

 const handleSave = async () => {
 setIsSaving(true);
 setMessage('');

 try {
 await saveProductNamingRule(rule);
 setMessage('Γ£ô Naming rule saved successfully!');
 setTimeout(() => setMessage(''), 3000);
 } catch (error) {
 setMessage('Γ£ù Failed to save settings');
 } finally {
 setIsSaving(false);
 }
 };

 const previewName = () => {
 const examples: Record<string, { short: string; full: string }> = {
 category: { short: 'SHP', full: 'Shampoo' },
 brand: { short: 'H&S', full: 'Head & Shoulders' },
 family: { short: 'Citron', full: 'Citron' },
 emballage: { short: '400ml', full: '400ml' },
 country: { short: 'LB', full: 'Lebanon' },
 };

 const parts = rule.components
 .filter(c => c.enabled)
 .map(c => c.useShortName ? examples[c.id].short : examples[c.id].full);

 return parts.join(rule.separator);
 };

 return (
 <div className="space-y-6">
 {/* Components List */}
 <div className="space-y-3">
 <p className="text-sm font-medium text-gray-700">Naming Components (drag to reorder)</p>

 {rule.components.map((component, index) => (
 <div
 key={component.id}
 className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${component.enabled
 ? 'bg-app-surface border-emerald-200'
 : 'bg-app-bg border-app-border opacity-60'
 }`}
 >
 {/* Reorder Buttons */}
 <div className="flex flex-col gap-1">
 <button
 onClick={() => moveComponent(index, 'up')}
 disabled={index === 0}
 className="p-1 text-app-text-faint hover:text-app-text-muted disabled:opacity-30"
 >
 <ArrowUp className="w-4 h-4" />
 </button>
 <button
 onClick={() => moveComponent(index, 'down')}
 disabled={index === rule.components.length - 1}
 className="p-1 text-app-text-faint hover:text-app-text-muted disabled:opacity-30"
 >
 <ArrowDown className="w-4 h-4" />
 </button>
 </div>

 {/* Component Label */}
 <div className="flex-1">
 <p className="font-medium text-app-text">{component.label}</p>
 <p className="text-xs text-app-text-muted">ID: {component.id}</p>
 </div>

 {/* Toggle Short Name */}
 {component.id !== 'family' && (
 <button
 onClick={() => toggleComponent(index, 'useShortName')}
 disabled={!component.enabled}
 className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${component.useShortName
 ? 'bg-blue-100 text-blue-700'
 : 'bg-app-surface-2 text-app-text-muted'
 }`}
 >
 {component.useShortName ? 'Short' : 'Full'}
 </button>
 )}

 {/* Enable/Disable Toggle */}
 <button
 onClick={() => toggleComponent(index, 'enabled')}
 className="p-2 rounded-lg hover:bg-app-surface-2 transition-colors"
 >
 {component.enabled ? (
 <Eye className="w-5 h-5 text-emerald-600" />
 ) : (
 <EyeOff className="w-5 h-5 text-app-text-faint" />
 )}
 </button>
 </div>
 ))}
 </div>

 {/* Separator */}
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Separator</label>
 <input
 type="text"
 value={rule.separator}
 onChange={(e) => setRule({ ...rule, separator: e.target.value })}
 className="w-32 px-3 py-2 border border-app-border rounded-lg"
 placeholder="Space"
 />
 <p className="text-xs text-app-text-muted mt-1">Character(s) between components (default: space)</p>
 </div>

 {/* Preview */}
 <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-6 rounded-lg border border-emerald-200">
 <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
 <p className="text-2xl font-bold text-app-text">{previewName()}</p>
 <p className="text-xs text-app-text-muted mt-2">Example: Shampoo (H&S Citron 400ml from Lebanon)</p>
 </div>

 {/* Save Button */}
 <div className="flex items-center gap-4">
 <button
 onClick={handleSave}
 disabled={isSaving}
 className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 {isSaving ? 'Saving...' : 'Save Naming Rule'}
 </button>

 {message && (
 <p className={`text-sm font-medium ${message.startsWith('Γ£ô') ? 'text-emerald-600' : 'text-red-600'}`}>
 {message}
 </p>
 )}
 </div>
 </div>
 );
}