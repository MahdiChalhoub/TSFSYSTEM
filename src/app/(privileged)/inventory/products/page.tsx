import { erpFetch } from '@/lib/erp-api'
import ProductMasterManager from './manager'

export const dynamic = 'force-dynamic'

async function safeLoad(url: string) {
  try {
    const d = await erpFetch(url)
    return Array.isArray(d) ? d : d?.results || []
  } catch { return [] }
}

export default async function ProductMasterPage() {
  const [products, categories, brands, units, countries] = await Promise.all([
    safeLoad('inventory/products/?page_size=500'),
    safeLoad('inventory/categories/'),
    safeLoad('inventory/brands/'),
    safeLoad('inventory/units/'),
    safeLoad('reference/countries/'),
  ])

  return (
    <ProductMasterManager
      initialProducts={products}
      lookups={{
        categories: categories.map((c: any) => ({ id: c.id, name: c.name })),
        brands: brands.map((b: any) => ({ id: b.id, name: b.name })),
        units: units.map((u: any) => ({ id: u.id, name: u.name, short_name: u.short_name })),
        countries: countries.map((c: any) => ({ id: c.id, name: c.name })),
      }}
    />
  )
}
