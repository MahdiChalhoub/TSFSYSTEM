import { erpFetch } from "@/lib/erp-api"
import PortalPreview from "@/components/workspace/PortalPreview"

export const dynamic = 'force-dynamic'

async function getOrgSlug() {
    try {
        const orgs = await erpFetch('organizations/')
        if (Array.isArray(orgs) && orgs.length > 0) {
            return orgs[0].slug as string
        }
    } catch { }
    return null
}

export default async function SupplierGatePreviewPage() {
    const slug = await getOrgSlug()

    if (!slug) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-300">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></svg>
                    </div>
                    <p className="text-gray-600 font-semibold">No organization found</p>
                    <p className="text-sm text-gray-400">Unable to determine your organization slug for the preview.</p>
                </div>
            </div>
        )
    }

    const previewUrl = `/supplier-portal/${slug}`

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <PortalPreview
                url={previewUrl}
                title="Supplier Gate Preview"
                subtitle="See exactly what your suppliers see when they access their portal"
                accentColor="indigo"
            />
        </div>
    )
}
