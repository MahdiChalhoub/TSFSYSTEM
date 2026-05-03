'use client'

import { BrandsClient } from './BrandsClient'
import type { Brand } from './components/types'

type BrandsGatewayProps = {
    brands: Brand[]
    countries: Array<Record<string, unknown>>
    categories: Array<Record<string, unknown>>
    attributes: Array<Record<string, unknown>>
}

export function BrandsGateway(props: BrandsGatewayProps) {
    return <BrandsClient {...props} />
}

