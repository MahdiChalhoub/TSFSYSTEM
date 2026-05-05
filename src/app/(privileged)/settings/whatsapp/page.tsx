'use client';

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle, Settings, Key, Phone, Save, AlertCircle } from "lucide-react";
import { getWhatsappConfig, saveWhatsappConfig, WhatsappConfig, WhatsappProvider } from "@/app/actions/whatsapp-settings";
import clsx from "clsx";
import { SettingsPageShell } from '@/lib/settings-framework/components/SettingsPageShell';

export default function WhatsappSettingsPage() {
 const [config, setConfig] = useState<WhatsappConfig>({
 is_active: false,
 provider: ''
 });
 const [loading, setLoading] = useState(true);
 const [isPending, startTransition] = useTransition();

 useEffect(() => {
 loadData();
 }, []);

 async function loadData() {
 try {
 const data = await getWhatsappConfig();
 setConfig(data);
 } catch {
 toast.error("Failed to load WhatsApp configuration");
 } finally {
 setLoading(false);
 }
 }

 function handleChange(field: keyof WhatsappConfig, value: string | boolean) {
 setConfig(prev => ({ ...prev, [field]: value }));
 }

 function handleSave(e: React.FormEvent) {
 e.preventDefault();
 startTransition(async () => {
 const res = await saveWhatsappConfig(config);
 if (res.success) {
 toast.success("WhatsApp configuration saved successfully");
 } else {
 toast.error(res.message || "Failed to save configuration");
 }
 });
 }



 return (
 <SettingsPageShell
     title="WhatsApp Alerts"
     subtitle="Configure provider credentials and delivery settings"
     icon={<MessageCircle size={20} className="text-white" />}
     configKey="whatsapp"
     config={config as any}
     hasChanges={!loading}
     onSave={() => { const form = document.querySelector('form'); if (form) form.requestSubmit(); }}
     saving={isPending}
 >
  {loading ? (
   <div className="flex items-center justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-2 border-app-primary border-t-transparent" /></div>
  ) : (
  <div className="max-w-4xl mx-auto">

 <form onSubmit={handleSave} className="space-y-6">
 {/* Master Switch */}
 <div className="bg-app-surface rounded-3xl shadow-xl border border-app-border overflow-hidden">
 <div className="p-6 border-b border-app-border bg-[#F8FAFC]">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-app-muted-foreground uppercase">Master Control</h2>
 <p className="text-xs text-app-muted-foreground mt-1 font-medium">
 Enable or disable out-bound WhatsApp alerts entirely
 </p>
 </div>
 <button
 type="button"
 onClick={() => handleChange('is_active', !config.is_active)}
 className={`w-14 h-8 rounded-full transition-all relative ${config.is_active
 ? 'bg-app-primary shadow-inner shadow-emerald-600'
 : 'bg-app-border'
 }`}
 >
 <div
 className={`absolute top-1 w-6 h-6 rounded-full bg-app-surface shadow transition-all ${config.is_active ? 'left-7' : 'left-1'
 }`}
 />
 </button>
 </div>
 </div>

 {/* Provider Selection */}
 <div className="p-6 space-y-4">
 <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest">Select Provider</label>
 <div className="grid grid-cols-3 gap-4">
 {(['TWILIO', 'MESSAGEBIRD', 'META'] as WhatsappProvider[]).map((prov) => (
 <div
 key={prov}
 onClick={() => handleChange('provider', prov)}
 className={clsx(
 "cursor-pointer border-2 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all",
 config.provider === prov
 ? "border-app-primary bg-app-primary-light text-app-success"
 : "border-app-border bg-app-surface hover:border-app-success text-app-muted-foreground"
 )}
 >
 <Settings size={24} className={config.provider === prov ? "text-app-primary" : "text-app-muted-foreground"} />
 <span className="font-bold tracking-tight text-sm">
 {prov === 'META' ? 'Official Meta API' : prov === 'TWILIO' ? 'Twilio' : 'MessageBird'}
 </span>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* dynamic Provider Settings */}
 {config.is_active && config.provider && (
 <div className="bg-app-surface rounded-3xl shadow-xl border border-app-border overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
 <div className="p-6 border-b border-app-border bg-[#F8FAFC] flex items-center justify-between">
 <h2 className="text-app-muted-foreground uppercase">
 {config.provider} Credentials
 </h2>
 </div>

 <div className="page-container">
 {config.provider === 'TWILIO' && (
 <>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest flex items-center gap-2">
 <Key size={14} /> Account SID
 </label>
 <input
 type="text"
 value={config.account_sid || ''}
 onChange={(e) => handleChange('account_sid', e.target.value)}
 className="w-full bg-app-background border-app-border text-sm font-bold rounded-xl h-11 px-4 focus:ring-app-primary"
 placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
 required={config.is_active}
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest flex items-center gap-2">
 <Key size={14} /> Auth Token
 </label>
 <input
 type="password"
 value={config.auth_token || ''}
 onChange={(e) => handleChange('auth_token', e.target.value)}
 className="w-full bg-app-background border-app-border text-sm font-bold rounded-xl h-11 px-4 focus:ring-app-primary"
 placeholder="••••••••••••••••"
 required={config.is_active}
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest flex items-center gap-2">
 <Phone size={14} /> From Number
 </label>
 <input
 type="text"
 value={config.from_number || ''}
 onChange={(e) => handleChange('from_number', e.target.value)}
 className="w-full bg-app-background border-app-border text-sm font-bold rounded-xl h-11 px-4 focus:ring-app-primary"
 placeholder="whatsapp:+14155238886"
 required={config.is_active}
 />
 <p className="text-xs text-app-muted-foreground">Include 'whatsapp:' prefix if required by Twilio</p>
 </div>
 </>
 )}

 {config.provider === 'MESSAGEBIRD' && (
 <>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest flex items-center gap-2">
 <Key size={14} /> Access Key (API Key)
 </label>
 <input
 type="password"
 value={config.api_key || ''}
 onChange={(e) => handleChange('api_key', e.target.value)}
 className="w-full bg-app-background border-app-border text-sm font-bold rounded-xl h-11 px-4 focus:ring-app-primary"
 placeholder="live_xxxxxxxxxxxxxxxxxxxxxx"
 required={config.is_active}
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest flex items-center gap-2">
 <Key size={14} /> Channel ID
 </label>
 <input
 type="text"
 value={config.channel_id || ''}
 onChange={(e) => handleChange('channel_id', e.target.value)}
 className="w-full bg-app-background border-app-border text-sm font-bold rounded-xl h-11 px-4 focus:ring-app-primary"
 placeholder="e.g. 5xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx"
 required={config.is_active}
 />
 </div>
 </>
 )}

 {config.provider === 'META' && (
 <>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest flex items-center gap-2">
 <Key size={14} /> System User Access Token
 </label>
 <input
 type="password"
 value={config.access_token || ''}
 onChange={(e) => handleChange('access_token', e.target.value)}
 className="w-full bg-app-background border-app-border text-sm font-bold rounded-xl h-11 px-4 focus:ring-app-primary"
 placeholder="EAAxxxxxxxxxxxxxxxxxxxxxx"
 required={config.is_active}
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest flex items-center gap-2">
 <Key size={14} /> Phone Number ID
 </label>
 <input
 type="text"
 value={config.phone_number_id || ''}
 onChange={(e) => handleChange('phone_number_id', e.target.value)}
 className="w-full bg-app-background border-app-border text-sm font-bold rounded-xl h-11 px-4 focus:ring-app-primary"
 placeholder="1234567890123"
 required={config.is_active}
 />
 </div>
 </>
 )}
 </div>
 </div>
 )}

 {/* Save Button */}
 <div className="flex justify-end pt-4">
 <button
 type="submit"
 disabled={isPending}
 className="h-12 px-8 flex items-center gap-2 bg-app-primary hover:bg-app-success text-app-foreground font-bold rounded-2xl transition-all disabled:opacity-50"
 >
 {isPending ? <div className="w-5 h-5 border-2 border-app-foreground/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
 Save Configuration
 </button>
 </div>

 </form>
 </div>
 )}
 </SettingsPageShell>
 );
}
