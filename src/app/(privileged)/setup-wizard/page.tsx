import { redirect } from 'next/navigation'
import { getWizardConfig, getOrganizationProfile, getOnboardingStatus } from '@/app/actions/setup-wizard'
import SetupWizardClient from './client'

export const dynamic = 'force-dynamic'

export default async function SetupWizardPage() {
 // Guard: If onboarding is already completed, redirect to dashboard
 const isCompleted = await getOnboardingStatus()
 if (isCompleted) {
 redirect('/dashboard')
 }

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
