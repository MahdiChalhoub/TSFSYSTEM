'use client'

import { useState } from "react"
import { updateTransactionSequence } from "@/app/actions/sequences"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

type Sequence = {
    id: number
    type: string
    prefix: string | null
    suffix: string | null
    nextNumber: number
    padding: number
    updatedAt: Date
}

export function SequencesList({ initialSequences }: { initialSequences: Sequence[] }) {
    const [sequences, setSequences] = useState(initialSequences)
    const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({})
    const [editedMap, setEditedMap] = useState<Record<number, Sequence>>({})

    const handleChange = (id: number, field: keyof Sequence, value: any) => {
        setEditedMap(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] || sequences.find(s => s.id === id)!),
                [field]: value
            }
        }))
    }

    const handleSave = async (id: number) => {
        const data = editedMap[id]
        if (!data) return

        setLoadingMap(prev => ({ ...prev, [id]: true }))
        try {
            const res = await updateTransactionSequence({
                id: data.id,
                prefix: data.prefix || undefined,
                suffix: data.suffix || undefined,
                nextNumber: Number(data.nextNumber),
                padding: Number(data.padding)
            })

            if (res.success) {
                toast.success("Sequence updated")
                setSequences(prev => prev.map(s => s.id === id ? { ...data, updatedAt: new Date() } : s))
                setEditedMap(prev => {
                    const next = { ...prev }
                    delete next[id]
                    return next
                })
            } else {
                toast.error("Failed to update")
            }
        } catch (e) {
            toast.error("Error saving sequence")
        } finally {
            setLoadingMap(prev => ({ ...prev, [id]: false }))
        }
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Prefix</TableHead>
                        <TableHead>Suffix</TableHead>
                        <TableHead>Padding</TableHead>
                        <TableHead>Next Number</TableHead>
                        <TableHead>Preview</TableHead>
                        <TableHead className="w-[100px]">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sequences.map((seq) => {
                        const edited = editedMap[seq.id] || seq
                        const isEdited = !!editedMap[seq.id]
                        const isLoading = loadingMap[seq.id]

                        const preview = `${edited.prefix || ''}${edited.nextNumber.toString().padStart(edited.padding, '0')}${edited.suffix || ''}`

                        return (
                            <TableRow key={seq.id}>
                                <TableCell className="font-medium">{seq.type}</TableCell>
                                <TableCell>
                                    <Input
                                        value={edited.prefix || ''}
                                        onChange={(e) => handleChange(seq.id, 'prefix', e.target.value)}
                                        className="w-24 h-8"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        value={edited.suffix || ''}
                                        onChange={(e) => handleChange(seq.id, 'suffix', e.target.value)}
                                        className="w-24 h-8"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        value={edited.padding}
                                        onChange={(e) => handleChange(seq.id, 'padding', Number(e.target.value))}
                                        className="w-16 h-8"
                                        min={1}
                                        max={20}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        value={edited.nextNumber}
                                        onChange={(e) => handleChange(seq.id, 'nextNumber', Number(e.target.value))}
                                        className="w-24 h-8"
                                        min={1}
                                    />
                                </TableCell>
                                <TableCell className="text-muted-foreground font-mono">
                                    {preview}
                                </TableCell>
                                <TableCell>
                                    {isEdited && (
                                        <Button
                                            size="sm"
                                            onClick={() => handleSave(seq.id)}
                                            disabled={isLoading}
                                        >
                                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}