import Link from 'next/link';
import { erpFetch } from "@/lib/erp-api";

async function getFeaturedProducts() {
 try {
 const products = await erpFetch('products/');
 return products.slice(0, 8);
 } catch (e) {
 console.error("Storefront fetch failed:", e);
 return [];
 }
}

export default async function StorefrontFeatured() {
 const products = await getFeaturedProducts();

 return (
 <section id="featured" style={{ background: '#F8FAFC', padding: '6rem 0' }}>
 <div className="container">
 <div className="flex justify-between items-end" style={{ marginBottom: '3rem' }}>
 <div>
 <h2 style={{ marginBottom: '0.5rem' }}>Weekly Best Sellers</h2>
 <p>Grab them while they last!</p>
 </div>
 <Link href="/search" className="btn-outline" style={{ padding: '8px 24px' }}>View All Products</Link>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
 {products.length === 0 && <p>No products featured at this time.</p>}

 {products.map((product: Record<string, any>) => (
 <div key={product.id} className="card" style={{ padding: '0', overflow: 'hidden', border: 'none' }}>
 <div style={{ height: '220px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6rem', position: 'relative' }}>
 <span style={{ filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.1))', transition: 'transform 0.3s' }} className="product-emoji">
 {/* Fallback emoji based on ID since we don't have images yet */}
 {product.name.includes('Apple') ? '≡ƒìÄ' : product.name.includes('Milk') ? '≡ƒÑ¢' : '≡ƒôª'}
 </span>
 <button style={{
 position: 'absolute', bottom: '1rem', right: '1rem',
 width: '40px', height: '40px', borderRadius: '50%',
 background: 'white', border: 'none',
 boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: 'pointer',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 color: 'var(--primary)'
 }}>
 +
 </button>
 </div>
 <div style={{ padding: '1.5rem' }}>
 <div className="flex justify-between items-start" style={{ marginBottom: '0.5rem' }}>
 <span className="badge" style={{ background: 'var(--background)', fontSize: '0.75rem' }}>
 Tax Inc
 </span>
 <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>
 ${Number(product.selling_price_ttc).toFixed(2)}
 </span>
 </div>
 <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{product.name}</h3>
 <div className="flex gap-1">
 {'Γ¡É'.repeat(5)} <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>(New)</span>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </section>
 );
}