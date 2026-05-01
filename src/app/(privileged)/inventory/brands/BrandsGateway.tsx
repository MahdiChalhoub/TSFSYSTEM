'use client'

import { BrandsClient } from './BrandsClient'

type BrandRow = {
    id: number
    name: string
    short_name?: string | null
    logo?: string | null
    countries?: Array<{ id: number; name: string; code?: string }>
    categories?: Array<{ id: number; name: string; code?: string }>
    product_count?: number
    created_at?: string
}

type BrandsGatewayProps = {
    brands: BrandRow[]
    countries: Array<Record<string, unknown>>
    categories: Array<Record<string, unknown>>
}

export function BrandsGateway(props: BrandsGatewayProps) {
    return <BrandsClient {...props} />
}
