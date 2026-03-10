import { getCOASetupStatus } from '@/app/actions/finance/coa-setup'
import { COASetupWizard } from './wizard'

export default async function COASetupPage() {
    const setupState = await getCOASetupStatus()

    return <COASetupWizard initialState={setupState} />
}
