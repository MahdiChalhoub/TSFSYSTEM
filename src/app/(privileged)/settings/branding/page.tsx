import { getLoginBranding } from "@/app/actions/branding";
import { LoginBrandingEditor } from "./LoginBrandingEditor";
import { Paintbrush } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function BrandingSettingsPage() {
    const branding = await getLoginBranding();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* V2 Icon-Box Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                            background: 'var(--app-primary-bg, color-mix(in srgb, var(--app-primary) 10%, transparent))',
                            border: '1px solid var(--app-primary-border, color-mix(in srgb, var(--app-primary) 20%, transparent))',
                        }}
                    >
                        <Paintbrush size={26} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                            Settings / Appearance
                        </p>
                        <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--app-foreground)' }}>
                            Login Page Branding
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                            Customize how your login page appears to your team and clients.
                        </p>
                    </div>
                </div>
            </header>

            <LoginBrandingEditor initialBranding={branding} />
        </div>
    );
}
