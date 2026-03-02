'use client';

import { useState, useEffect } from 'react';
import { getBarcodeSettings, updateBarcodeSettings } from '@/app/actions/barcode-settings';
import { Save, RefreshCw, Barcode } from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function BarcodeSettingsPage() {
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

 const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
 defaultValues: {
 prefix: '200',
 nextSequence: 1000,
 isEnabled: true
 }
 });

 useEffect(() => {
 async function load() {
 setLoading(true);
 const res = await getBarcodeSettings();
 if (res.success && res.data) {
 setValue('prefix', res.data.prefix);
 setValue('nextSequence', res.data.nextSequence);
 setValue('isEnabled', res.data.isEnabled);
 }
 setLoading(false);
 }
 load();
 }, [setValue]);

 const onSubmit = async (data: Record<string, any>) => {
 setSaving(true);
 setMessage(null);

 const res = await updateBarcodeSettings(data);

 if (res.success) {
 setMessage({ type: 'success', text: 'Settings saved successfully' });
 } else {
 setMessage({ type: 'error', text: res.error || 'Failed to save' });
 }
 setSaving(false);
 };

 const prefix = watch('prefix');
 const seq = watch('nextSequence');
 const exampleBarcode = `${prefix || '200'}${String(seq || 1000).padStart(12 - (prefix?.length || 3), '0')}X`;

 if (loading) return <div className="p-8 text-center text-app-text-muted">Loading settings...</div>;

 return (
 <div className="space-y-6 animate-in fade-in duration-500">
 <div className="flex items-center gap-4 mb-8">
 <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
 <Barcode size={28} className="text-white" />
 </div>
 <div>
 <h1 className="page-header-title tracking-tighter">Barcode <span className="text-emerald-600">Configuration</span></h1>
 <p className="text-app-text-muted">Manage automatic EAN-13 barcode generation rules.</p>
 </div>
 </div>

 <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

 {/* Preview Box */}
 <div className="bg-gray-900 text-white p-6 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-xl">
 <span className="text-xs font-mono uppercase text-app-text-faint tracking-widest">Next Barcode Preview</span>
 <div className="text-4xl font-mono font-bold tracking-widest">{exampleBarcode}</div>
 <div className="text-xs text-app-text-muted mt-2 flex gap-4">
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Prefix: {prefix}</span>
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Sequence: {seq}</span>
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Check Digit: X</span>
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-2xl border border-app-border shadow-sm space-y-6">
 <div className="flex items-center justify-between">
 <label className="flex items-center gap-3 cursor-pointer">
 <input
 type="checkbox"
 {...register('isEnabled')}
 className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-app-border"
 />
 <span className="font-medium text-gray-700">Enable Automatic Generation</span>
 </label>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Barcode Prefix (2-3 chars)</label>
 <input
 type="text"
 {...register('prefix', { required: true, minLength: 2, maxLength: 3 })}
 className="w-full px-4 py-2 border border-app-border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
 placeholder="200"
 />
 <p className="mt-1 text-xs text-app-text-faint">Usually '020' - '299' for in-store items.</p>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Next Sequence Number</label>
 <input
 type="number"
 {...register('nextSequence', { required: true, min: 1 })}
 className="w-full px-4 py-2 border border-app-border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
 />
 <p className="mt-1 text-xs text-app-text-faint">Will increment automatically.</p>
 </div>
 </div>
 </div>

 {message && (
 <div className={`p-4 rounded-xl flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
 {message.text}
 </div>
 )}

 <div className="flex justify-end pt-4">
 <button
 type="submit"
 disabled={saving}
 className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-emerald-900/20 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
 <span>Save Settings</span>
 </button>
 </div>
 </form>
 </div>
 );
}