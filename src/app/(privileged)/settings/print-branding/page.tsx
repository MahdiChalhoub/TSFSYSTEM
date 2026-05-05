import { erpFetch } from '@/lib/erp-api';
import { Printer } from 'lucide-react';
import { PrintBrandingClient } from './PrintBrandingClient';

export const dynamic = 'force-dynamic';

/** SSR fetch the current organization profile so the client can hydrate
 *  with real data immediately — no flicker, no loading shell. */
async function getOrg() {
    try {
        return await erpFetch('organizations/me/');
    } catch {
        return null;
    }
}

export default async function PrintBrandingPage() {
    const org = await getOrg();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)',
                        }}
                    >
                        <Printer size={26} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                            Settings / Documents
                        </p>
                        <h1>
                            Print Letterhead
                        </h1>
                        <p className="text-sm mt-0.5 text-app-muted-foreground">
                            What appears on every printed list, report, and document.
                        </p>
                    </div>
                </div>
            </header>

            <PrintBrandingClient initialOrg={org} />
        </div>
    );
}
