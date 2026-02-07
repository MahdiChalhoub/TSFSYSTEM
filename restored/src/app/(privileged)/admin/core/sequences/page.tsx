import { getTransactionSequences } from "@/app/actions/sequences"
import { SequencesList } from "./sequences-list"

import { redirect } from 'next/navigation';

export default async function SequencesPage() {
    // [TEMPORARY] Simulate installed modules
    const installedModuleCodes: string[] = []; // BLANC SYSTEM

    if (!installedModuleCodes.includes('core')) {
        redirect('/admin');
    }

    const sequences = await getTransactionSequences()

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Transaction Numbering</h1>
                    <p className="text-muted-foreground">Configure prefixes, suffixes, and sequences for system documents.</p>
                </div>
            </div>

            <SequencesList initialSequences={sequences} />
        </div>
    )
}