
import Image from "next/image";
import { prisma } from "@/lib/db";

async function getFeaturedProducts() {
  // Fetch products from DB
  const products = await prisma.product.findMany({
    take: 8,
    orderBy: { id: 'desc' }
  });
  return products;
}

export default async function Home() {
  const products = await getFeaturedProducts();

  return (
    <main>
      {/* Hero Section */}
      <section style={{ position: 'relative', height: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: -1 }}>
          <Image
            src="/hero.png"
            alt="TSF Supermarket Aisle"
            fill
            style={{ objectFit: 'cover' }}
            priority
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7))' }}></div>
        </div>
        <div className="container text-center animate-fade-in" style={{ position: 'relative', zIndex: 1 }}>
          <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', backdropFilter: 'blur(4px)', marginBottom: '1rem', padding: '8px 20px' }}>
            Welcome to TSF
          </span>
          <h1 style={{ color: 'white', marginBottom: '1.5rem', textShadow: '0 4px 6px rgba(0,0,0,0.3)', maxWidth: '900px', marginInline: 'auto' }}>
            Premium Quality, <br /><span style={{ color: 'var(--accent)' }}>Delivered Fresh</span>
          </h1>
          <p style={{ fontSize: '1.25rem', marginBottom: '2.5rem', maxWidth: '600px', marginInline: 'auto', color: '#F3F4F6' }}>
            Experience the finest selection of organic produce, daily essentials, and premium goods at TSF Supermarket.
          </p>
          <div className="flex justify-center gap-4">
            <a href="#featured" className="btn-primary" style={{ padding: '16px 40px', fontSize: '1.1rem' }}>Start Shopping</a>
            <a href="#deals" className="btn" style={{ background: 'white', color: 'var(--secondary)', padding: '16px 40px', fontSize: '1.1rem' }}>View Deals</a>
          </div>
        </div>
      </section>

      {/* Benefits Strip */}
      <div style={{ background: 'var(--primary)', color: 'white', padding: '2rem 0' }}>
        <div className="container grid grid-cols-3 gap-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <span style={{ fontSize: '1.5rem' }}>🚚</span>
            <strong>Free Delivery over $50</strong>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span style={{ fontSize: '1.5rem' }}>🌿</span>
            <strong>100% Organic Options</strong>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span style={{ fontSize: '1.5rem' }}>🛡️</span>
            <strong>Quality Guarantee</strong>
          </div>
        </div>
      </div>

      {/* Categories */}
      <section className="container" style={{ padding: '6rem 20px' }}>
        <h2 className="text-center" style={{ marginBottom: '1rem' }}>Shop by Category</h2>
        <p className="text-center" style={{ marginBottom: '3rem', color: 'var(--text-muted)' }}>Find everything you need for your home</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { name: 'Fresh Produce', icon: '🍎', color: '#FEF2F2' },
            { name: 'Dairy & Eggs', icon: '🥛', color: '#EFF6FF' },
            { name: 'Bakery', icon: '🥖', color: '#FFFBEB' },
            { name: 'Meat & Seafood', icon: '🥩', color: '#FEF2F2' }
          ].map((cat, i) => (
            <div key={i} className="card text-center" style={{ cursor: 'pointer', border: 'none', background: cat.color }}>
              <div style={{
                width: '80px', height: '80px',
                background: 'white', borderRadius: '50%',
                margin: '0 auto 1.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.5rem',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
              }}>
                {cat.icon}
              </div>
              <h3 style={{ fontSize: '1.25rem' }}>{cat.name}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section id="featured" style={{ background: '#F8FAFC', padding: '6rem 0' }}>
        <div className="container">
          <div className="flex justify-between items-end" style={{ marginBottom: '3rem' }}>
            <div>
              <h2 style={{ marginBottom: '0.5rem' }}>Weekly Best Sellers</h2>
              <p>Grab them while they last!</p>
            </div>
            <a href="#" className="btn-outline" style={{ padding: '8px 24px' }}>View All Products</a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.length === 0 && <p>No products found in the database. Run seed!</p>}

            {products.map((product) => (
              <div key={product.id} className="card" style={{ padding: '0', overflow: 'hidden', border: 'none' }}>
                <div style={{ height: '220px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6rem', position: 'relative' }}>
                  <span style={{ filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.1))', transition: 'transform 0.3s' }} className="product-emoji">
                    {/* Fallback emoji based on ID since we don't have images yet */}
                    {product.name.includes('Apple') ? '🍎' : product.name.includes('Milk') ? '🥛' : '📦'}
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
                      {product.isTaxIncluded ? 'Tax Inc' : '+Tax'}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>
                      ${Number(product.basePrice).toFixed(2)}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{product.name}</h3>
                  <div className="flex gap-1">
                    {'⭐'.repeat(5)} <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>(New)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container" style={{ padding: '6rem 20px' }}>
        <div style={{
          background: 'var(--secondary)',
          borderRadius: '24px',
          padding: '4rem',
          textAlign: 'center',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h2 style={{ color: 'white', marginBottom: '1rem' }}>Download the TSF App</h2>
            <p style={{ marginBottom: '2rem', color: '#D1D5DB' }}>Get exclusive deals and track your delivery in real-time.</p>
            <div className="flex justify-center gap-4 flex-wrap">
              <button className="btn" style={{ background: 'black', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '12px 24px', borderRadius: '8px' }}>
                 App Store
              </button>
              <button className="btn" style={{ background: 'black', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '12px 24px', borderRadius: '8px' }}>
                ▶ Google Play
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

