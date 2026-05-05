import Link from 'next/link'
import { Award, Building2, ArrowRight } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
 *  NoTenantNotice — rendered by /inventory/brands when the
 *  request has no tenant context (typical when accessed via
 *  the saas.* root domain). Brands are tenant-scoped data, so
 *  fetching from this domain returns 404 for every endpoint.
 *  Surface that fact instead of pretending the catalog is empty.
 * ═══════════════════════════════════════════════════════════ */
export function NoTenantNotice() {
    return (
        <div className="max-w-2xl mx-auto py-12 px-6">
            <div className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                        color: 'var(--app-primary)',
                    }}>
                    <Award size={26} />
                </div>
                <div>
                    <h1>
                        Brands live inside an organization
                    </h1>
                    <p className="text-sm text-app-muted-foreground mt-2 max-w-md mx-auto">
                        You&apos;re on the SaaS root domain — there&apos;s no tenant context here, so the
                        brand catalog can&apos;t load. Switch to an organization to manage its brands.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <Link
                        href="/saas-home"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border border-app-border text-app-foreground hover:bg-app-surface transition-all">
                        Back to SaaS Home
                    </Link>
                    <Link
                        href="/switcher"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl text-white transition-all hover:shadow-md"
                        style={{ background: 'var(--app-primary)' }}>
                        <Building2 size={14} /> Pick an Organization <ArrowRight size={14} />
                    </Link>
                </div>

                <p className="text-[11px] text-app-muted-foreground mt-4">
                    Tip: tenant subdomains look like <span className="font-mono font-bold">acme.developos.shop/inventory/brands</span>.
                </p>
            </div>
        </div>
    )
}
