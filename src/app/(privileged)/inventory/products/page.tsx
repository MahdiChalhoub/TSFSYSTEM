import { erpFetch } from '@/lib/erp-api'
import ProductMasterManager from './manager'
import { RequestFlowProvider } from '@/components/products/RequestFlowProvider'

export const dynamic = 'force-dynamic'

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
  /* SSR fetches the bare minimum needed to paint the page:
   *   - products    → the table content (the user's reason for being here)
   *   - currentUser → drives staff-only UI bits + scope limiting
   *
   * The 7 lookup endpoints (categories / brands / units / countries /
   * sourcing-countries / attribute-tree / suppliers) only feed the Filters
   * panel, which is collapsed by default. Fetching them here used to gate
   * first paint behind 9 parallel HTTP round-trips; the manager now loads
   * them client-side after mount via useEffect, so first paint waits only
   * on the slowest of TWO requests instead of nine. */
  const [searchParams, [productsResp, currentUser]] = await Promise.all([
    props.searchParams,
    Promise.all([
      safeLoadPaginated(`products/?page_size=${INITIAL_PAGE_SIZE}`),
      import('@/app/actions/auth').then(m => m.getUser()),
    ]),
  ])
  const products = productsResp.results
  const totalProductCount = productsResp.count

  // URL entity-prefill (sent by EntityProductsTab empty-state "Browse &
  // Assign" CTAs). The manager applies this once lookups land client-side
  // so the human-name resolution can happen.
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
      />
    </RequestFlowProvider>
  )
}
