'use client';

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle, Settings, Key, Phone, Save, AlertCircle } from "lucide-react";
import { getWhatsappConfig, saveWhatsappConfig, WhatsappConfig, WhatsappProvider } from "@/app/actions/whatsapp-settings";
import clsx from "clsx";

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

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
                <div className="h-10 w-64 bg-gray-200 rounded-xl animate-pulse" />
                <div className="h-96 bg-gray-100 rounded-3xl animate-pulse" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <header>
                <h1 className="page-header-title  tracking-tighter flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                        <MessageCircle size={28} className="text-white" />
                    </div>
                    WhatsApp <span className="text-emerald-500">Integration</span>
                </h1>
                <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">
                    External Provider Engine Configuration
                </p>
            </header>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Master Switch */}
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-[#F8FAFC]">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-black text-gray-600 uppercase tracking-widest">Master Control</h2>
                                <p className="text-xs text-gray-400 mt-1 font-medium">
                                    Enable or disable out-bound WhatsApp alerts entirely
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleChange('is_active', !config.is_active)}
                                className={`w-14 h-8 rounded-full transition-all relative ${config.is_active
                                        ? 'bg-emerald-500 shadow-inner shadow-emerald-600'
                                        : 'bg-gray-200'
                                    }`}
                            >
                                <div
                                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${config.is_active ? 'left-7' : 'left-1'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Provider Selection */}
                    <div className="p-6 space-y-4">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Provider</label>
                        <div className="grid grid-cols-3 gap-4">
                            {(['TWILIO', 'MESSAGEBIRD', 'META'] as WhatsappProvider[]).map((prov) => (
                                <div
                                    key={prov}
                                    onClick={() => handleChange('provider', prov)}
                                    className={clsx(
                                        "cursor-pointer border-2 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all",
                                        config.provider === prov
                                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                            : "border-gray-100 bg-white hover:border-emerald-200 text-gray-500"
                                    )}
                                >
                                    <Settings size={24} className={config.provider === prov ? "text-emerald-500" : "text-gray-400"} />
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
                    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 border-b border-gray-100 bg-[#F8FAFC] flex items-center justify-between">
                            <h2 className="text-sm font-black text-gray-600 uppercase tracking-widest">
                                {config.provider} Credentials
                            </h2>
                        </div>

                        <div className="page-container">
                            {config.provider === 'TWILIO' && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <Key size={14} /> Account SID
                                        </label>
                                        <input
                                            type="text"
                                            value={config.account_sid || ''}
                                            onChange={(e) => handleChange('account_sid', e.target.value)}
                                            className="w-full bg-gray-50 border-gray-200 text-sm font-bold rounded-xl h-11 px-4 focus:ring-emerald-500"
                                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                            required={config.is_active}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <Key size={14} /> Auth Token
                                        </label>
                                        <input
                                            type="password"
                                            value={config.auth_token || ''}
                                            onChange={(e) => handleChange('auth_token', e.target.value)}
                                            className="w-full bg-gray-50 border-gray-200 text-sm font-bold rounded-xl h-11 px-4 focus:ring-emerald-500"
                                            placeholder="••••••••••••••••"
                                            required={config.is_active}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <Phone size={14} /> From Number
                                        </label>
                                        <input
                                            type="text"
                                            value={config.from_number || ''}
                                            onChange={(e) => handleChange('from_number', e.target.value)}
                                            className="w-full bg-gray-50 border-gray-200 text-sm font-bold rounded-xl h-11 px-4 focus:ring-emerald-500"
                                            placeholder="whatsapp:+14155238886"
                                            required={config.is_active}
                                        />
                                        <p className="text-xs text-gray-400">Include 'whatsapp:' prefix if required by Twilio</p>
                                    </div>
                                </>
                            )}

                            {config.provider === 'MESSAGEBIRD' && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <Key size={14} /> Access Key (API Key)
                                        </label>
                                        <input
                                            type="password"
                                            value={config.api_key || ''}
                                            onChange={(e) => handleChange('api_key', e.target.value)}
                                            className="w-full bg-gray-50 border-gray-200 text-sm font-bold rounded-xl h-11 px-4 focus:ring-emerald-500"
                                            placeholder="live_xxxxxxxxxxxxxxxxxxxxxx"
                                            required={config.is_active}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <Key size={14} /> Channel ID
                                        </label>
                                        <input
                                            type="text"
                                            value={config.channel_id || ''}
                                            onChange={(e) => handleChange('channel_id', e.target.value)}
                                            className="w-full bg-gray-50 border-gray-200 text-sm font-bold rounded-xl h-11 px-4 focus:ring-emerald-500"
                                            placeholder="e.g. 5xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx"
                                            required={config.is_active}
                                        />
                                    </div>
                                </>
                            )}

                            {config.provider === 'META' && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <Key size={14} /> System User Access Token
                                        </label>
                                        <input
                                            type="password"
                                            value={config.access_token || ''}
                                            onChange={(e) => handleChange('access_token', e.target.value)}
                                            className="w-full bg-gray-50 border-gray-200 text-sm font-bold rounded-xl h-11 px-4 focus:ring-emerald-500"
                                            placeholder="EAAxxxxxxxxxxxxxxxxxxxxxx"
                                            required={config.is_active}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <Key size={14} /> Phone Number ID
                                        </label>
                                        <input
                                            type="text"
                                            value={config.phone_number_id || ''}
                                            onChange={(e) => handleChange('phone_number_id', e.target.value)}
                                            className="w-full bg-gray-50 border-gray-200 text-sm font-bold rounded-xl h-11 px-4 focus:ring-emerald-500"
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
                        className="h-12 px-8 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all disabled:opacity-50"
                    >
                        {isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
                        Save Configuration
                    </button>
                </div>

            </form>
        </div>
    );
}
