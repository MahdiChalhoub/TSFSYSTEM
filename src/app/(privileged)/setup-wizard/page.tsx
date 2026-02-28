import { getWizardConfig, getOrganizationProfile } from '@/app/actions/setup-wizard'
import SetupWizardClient from './client'

export const dynamic = 'force-dynamic'

export default async function SetupWizardPage() {
    const [config, orgProfile] = await Promise.all([
        getWizardConfig(),
        getOrganizationProfile(),
    ])

    return (
        <SetupWizardClient
            config={config}
            orgProfile={orgProfile}
        />
    )
}
