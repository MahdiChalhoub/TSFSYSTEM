import { CountriesClient } from './CountriesClient'
import { getSourcingCountries, getRefCountries } from '@/app/actions/reference'

export const dynamic = 'force-dynamic'

export default async function CountriesPage() {
    const [sourcing, refCountries] = await Promise.all([
        getSourcingCountries(),
        getRefCountries({ is_active: true }),
    ])

    return (
        <CountriesClient
            initialSourcing={Array.isArray(sourcing) ? sourcing : []}
            initialRefCountries={Array.isArray(refCountries) ? refCountries : []}
        />
    )
}
