import { getAllocationWorkbench } from '@/app/actions/finance/allocation'
import { AllocationWorkbenchClient } from './AllocationWorkbenchClient'

export default async function AllocationWorkbenchPage() {
    const report = await getAllocationWorkbench('AR')
    return (
        <div className="h-full flex flex-col">
            <AllocationWorkbenchClient initialReport={JSON.parse(JSON.stringify(report))} />
        </div>
    )
}
