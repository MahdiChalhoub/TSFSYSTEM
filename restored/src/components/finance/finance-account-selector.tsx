'use client'

import { useEffect, useState } from "react"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"


export function FinanceAccountSelector({
    value,
    onChange,
    label = "Select Account"
}: {
    value?: string,
    onChange: (val: string) => void,
    label?: string
}) {
    const [accounts, setAccounts] = useState<any[]>([])

    useEffect(() => {
        getFinancialAccounts().then(setAccounts)
    }, [])

    return (
        <div className="space-y-1">
            <label className="text-sm font-medium">{label}</label>
            <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="" disabled>Select account...</option>
                {accounts.map(acc => (
                    <option key={acc.id} value={String(acc.id)}>
                        {acc.name} ({acc.currency})
                    </option>
                ))}
            </select>
        </div>
    )
}