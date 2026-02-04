'use client'

import { useEffect, useState } from "react"
import { getContactsByType } from "@/app/actions/crm/contacts"


export function ContactPicker({
    type,
    value,
    onChange,
    label = "Select Contact"
}: {
    type: 'PARTNER' | 'SUPPLIER' | 'CUSTOMER',
    value?: string,
    onChange: (val: string) => void,
    label?: string
}) {
    const [contacts, setContacts] = useState<any[]>([])

    useEffect(() => {
        getContactsByType(type).then(setContacts)
    }, [type])

    return (
        <div className="space-y-1">
            <label className="text-sm font-medium">{label}</label>
            <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="" disabled>Select {type.toLowerCase()}...</option>
                {contacts.map(c => (
                    <option key={c.id} value={String(c.id)}>
                        {c.name}
                    </option>
                ))}
            </select>
        </div>
    )
}
