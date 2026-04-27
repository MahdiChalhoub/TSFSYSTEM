import { erpFetch } from '@/lib/erp-api'
import ProductMasterManager from './manager'
import { RequestFlowProvider } from '@/components/products/RequestFlowProvider'

export const dynamic = 'force-dynamic'

async function safeLoad(url: string) {
  try {
    const d = await erpFetch(url)
    return Array.isArray(d) ? d : d?.results || []
  } catch { return [] }
}

export default async function ProductMasterPage(props: {
  searchParams: Promise<{ unit?: string; category?: string; brand?: string }>
}) {
  const [searchParams, [products, categories, brands, units, countries]] = await Promise.all([
    props.searchParams,
    Promise.all([
      safeLoad('products/?page_size=500'),
      safeLoad('categories/'),
      safeLoad('brands/'),
      safeLoad('units/'),
      safeLoad('reference/countries/'),
    ]),
  ])

  // Build initial filter from URL entity-prefill params.
  // Sent by EntityProductsTab empty-state "Browse & Assign" CTAs.
  const initialFilters: Record<string, string> = {}
  if (searchParams.unit) initialFilters.unit = searchParams.unit
  if (searchParams.category) initialFilters.category = searchParams.category
  if (searchParams.brand) initialFilters.brand = searchParams.brand

  return (
    <RequestFlowProvider>
      <ProductMasterManager
        initialProducts={products}
        initialFilters={Object.keys(initialFilters).length ? initialFilters : undefined}
        lookups={{
          categories: categories.map((c: any) => ({ id: c.id, name: c.name })),
          brands: brands.map((b: any) => ({ id: b.id, name: b.name })),
          units: units.map((u: any) => ({ id: u.id, name: u.name, short_name: u.short_name })),
          countries: countries.map((c: any) => ({ id: c.id, name: c.name })),
        }}
      />
    </RequestFlowProvider>
  )
}
