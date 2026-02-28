import React from 'react';
import { Shield, Key, Lock, Fingerprint } from 'lucide-react';
import { TwoFactorSettings } from './TwoFactorSettings';
import { POSPinSettings } from './POSPinSettings';
import { meAction } from '@/app/actions/auth';
import { headers } from 'next/headers';

export default async function SecurityPage() {
    // We need to know if 2FA is already enabled for the current user
    let user: any = { is_2fa_enabled: false };
    try { user = await meAction(); } catch { }
    const headerStore = await headers();
    const userAgent = headerStore.get('user-agent') || 'Unknown device';
    // Derive a readable browser/OS label from user-agent
    const browser = userAgent.includes('Chrome') ? 'Chrome'
        : userAgent.includes('Firefox') ? 'Firefox'
            : userAgent.includes('Safari') ? 'Safari'
                : userAgent.includes('Edge') ? 'Edge'
                    : 'Browser';
    const os = userAgent.includes('Windows') ? 'Windows'
        : userAgent.includes('Mac') ? 'macOS'
            : userAgent.includes('Linux') ? 'Linux'
                : userAgent.includes('Android') ? 'Android'
                    : userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'iOS'
                        : 'Unknown OS';

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-3">
                        <div className="p-2 bg-slate-900 rounded-xl">
                            <Shield className="text-emerald-400" size={28} />
                        </div>
                        Security Center
                    </h1>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        Protect your account with advanced security protocols
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <TwoFactorSettings initialEnabled={user.is_2fa_enabled} />

                    {/* POS Access PINs — self-service for all users */}
                    <POSPinSettings
                        userId={user.id}
                        hasPosPin={!!(user as any).pos_pin}
                        hasOverridePin={!!(user as any).has_override_pin}
                        canSetOverride={(user as any).is_staff || (user as any).is_superuser || (user as any).role === 'manager'}
                    />

                    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-blue-50 rounded-2xl">
                                <Key className="text-blue-600" size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Session Management</h2>
                                <p className="text-xs text-gray-400 font-medium tracking-tight">Active devices and login history</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-100">
                                        <Lock size={18} className="text-gray-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-gray-900 tracking-tight">Current Session</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{os} • {browser} • {user.email || user.username || 'Authenticated'}</p>
                                    </div>
                                </div>
                                <Badge className="bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase border-none">Active Now</Badge>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-slate-900 p-8 rounded-[2rem] text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Shield size={120} />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tighter mb-2 relative z-10">Account Health</h3>
                        <p className="text-xs text-slate-400 font-medium mb-6 relative z-10">Security score and recommendations</p>

                        <div className="space-y-4 relative z-10">
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all" style={{ width: user.is_2fa_enabled ? '85%' : '45%' }}></div>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                {user.is_2fa_enabled ? 'Strong Protection' : 'Action Required'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SquareTerminal({ size, className }: { size?: number, className?: string }) {
    return <Lock size={size} className={className} />;
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${className}`}>{children}</span>;
}
