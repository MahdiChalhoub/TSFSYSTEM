import { FeaturesClient } from './FeaturesClient'
import { getOrgFeatures } from '@/app/actions/features'

export const dynamic = 'force-dynamic'

export default async function FeaturesPage() {
    const features = await getOrgFeatures()
    const cleanFeatures = JSON.parse(JSON.stringify(features))

    return (
        <div className="app-page p-4 md:p-6" style={{ height: '100%' }}>
            <FeaturesClient features={cleanFeatures} />
        </div>
    )
}
