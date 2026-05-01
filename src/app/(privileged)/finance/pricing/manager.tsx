'use client'

import { createPriceList } from '@/app/actions/finance/pricing'

export default function PriceListManager({ priceLists }: { priceLists: Record<string, any>[] }) {
    async function handleCreate(formData: FormData) {
        const name = formData.get('name') as string
        await createPriceList(name)
    }

    return (
        <div className="space-y-6">
            {/* Create New */}
            <div className="bg-app-surface p-4 rounded-lg shadow-sm border border-app-border">
                <h2 className="text-lg font-bold text-app-foreground mb-2">Create Price List</h2>
                <form action={handleCreate} className="flex gap-2">
                    <input name="name" placeholder="List Name (e.g. Wholesale 2026)" className="border p-2 rounded w-full" required suppressHydrationWarning={true} />
                    <button type="submit" className="bg-app-foreground text-white px-4 py-2 rounded shrink-0" suppressHydrationWarning={true}>Create</button>
                </form>
            </div>

            {/* List */}
            <div className="bg-app-surface rounded-lg shadow-sm border border-app-border overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-app-surface text-app-muted-foreground font-medium">
                        <tr>
                            <th className="px-4 py-2">Name</th>
                            <th className="px-4 py-2">Rules Count</th>
                            <th className="px-4 py-2">Default?</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border">
                        {priceLists.map(list => (
                            <tr key={list.id} className="hover:bg-app-surface">
                                <td className="px-4 py-3 font-medium text-app-foreground">{list.name}</td>
                                <td className="px-4 py-3">{list.rules.length}</td>
                                <td className="px-4 py-3">
                                    {list.isDefault ? <span className="bg-app-success-bg text-app-success text-xs px-2 py-1 rounded">Yes</span> : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {priceLists.length === 0 && (
                    <div className="text-center py-8 text-app-muted-foreground">No price lists defined.</div>
                )}
            </div>
        </div>
    )
}