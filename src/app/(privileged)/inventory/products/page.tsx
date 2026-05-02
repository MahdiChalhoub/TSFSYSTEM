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

/**
 * Paginated load — returns BOTH the slice and the true total from the DRF
 * `count` field. Without this, the footer would report `results.length` as
 * the total, which is wrong as soon as the DB has more rows than the page
 * size. The frontend needs the true count to render accurate "X of Y" text
 * and decide whether to trigger a follow-up fetch.
 */
async function safeLoadPaginated<T = any>(url: string): Promise<{ results: T[]; count: number }> {
  try {
    const d: any = await erpFetch(url)
    if (Array.isArray(d)) return { results: d, count: d.length }
    return {
      results: Array.isArray(d?.results) ? d.results : [],
      count: typeof d?.count === 'number' ? d.count : (Array.isArray(d?.results) ? d.results.length : 0),
    }
  } catch { return { results: [], count: 0 } }
}

// First-paint cap. Drop from the previous 500 — that was big enough to make
// SSR slow without giving the user anything they couldn't filter for. The
// list paginates 50/page client-side anyway. If a tenant has more products,
// the manager can lazy-fetch additional pages on demand via search/filter.
const INITIAL_PAGE_SIZE = 100

export default async function ProductMasterPage(props: {
  searchParams: Promise<{ unit?: string; category?: string; brand?: string }>
}) {
  const [searchParams, [productsResp, categories, brands, units, countries, sourcingCountries, attributeTree, currentUser]] = await Promise.all([
    props.searchParams,
    Promise.all([
      safeLoadPaginated(`products/?page_size=${INITIAL_PAGE_SIZE}`),
      safeLoad('categories/'),
      safeLoad('brands/'),
      safeLoad('units/'),
      safeLoad('reference/countries/'),
      safeLoad('reference/sourcing-countries/'),
      safeLoad('inventory/product-attributes/tree/'),
      import('@/app/actions/auth').then(m => m.getUser()),
    ]),
  ])
  const products = productsResp.results
  const totalProductCount = productsResp.count

  // Country filter prefers SourcingCountry (org-enabled list) over the raw
  // Country master — sourcing is the truth of "where can this org buy from".
  // Falls back to all countries if no sourcing list is configured yet.
  const countryLookup = (sourcingCountries.length > 0
    ? sourcingCountries.map((sc: any) => ({
        id: sc.country, // Country FK id (the actual Country PK)
        name: sc.country_name || sc.name || sc.country_iso2 || `#${sc.country}`,
      }))
    : countries.map((c: any) => ({ id: c.id, name: c.name }))
  )

  // Parfum filter pulls its options from the dynamic attribute tree (V2+).
  // Find the root attribute group whose name matches /parfum|fragrance/i and
  // expose its leaf children as the parfum filter options. The legacy
  // `parfums/` master is no longer the source of truth.
  const parfumRoot = (attributeTree as any[]).find((root: any) =>
    /parfum|fragrance/i.test(root?.name || '')
  )
  const parfumOptions: { id: number; name: string }[] = parfumRoot
    ? (parfumRoot.children || []).map((c: any) => ({ id: c.id, name: c.name }))
    : []

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
        totalProductCount={totalProductCount}
        initialFilters={Object.keys(initialFilters).length ? initialFilters : undefined}
        currentUser={currentUser}
        lookups={{
          categories: categories.map((c: any) => ({ id: c.id, name: c.name })),
          brands: brands.map((b: any) => ({ id: b.id, name: b.name })),
          units: units.map((u: any) => ({ id: u.id, name: u.name, short_name: u.short_name })),
          countries: countryLookup,
          parfums: parfumOptions,
        }}
      />
    </RequestFlowProvider>
  )
}
