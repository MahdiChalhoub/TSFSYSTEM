import type { ElementType } from 'react'

export type Sequence = {
    id?: number
    type: string
    prefix: string
    suffix: string
    next_number: number
    padding: number
}

export type TabKey = 'documents' | 'master'

export type DocumentType = {
    id: string
    label: string
    icon: ElementType
    color: string
}

export type TierDef = {
    key: string
    label: string
    desc: string
    icon: ElementType
    color: string
}

export type MasterDataType = {
    id: string
    label: string
    icon: ElementType
    color: string
    defaultPrefix: string
}
