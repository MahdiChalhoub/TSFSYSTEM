import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "TSF Supermarket | Freshness First",
  description: "Welcome to TSF Supermarket - Your source for fresh produce, groceries, and daily essentials.",
};

import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        <nav className="glass" style={{ position: 'sticky', top: 0, zIndex: 100, padding: '1rem 0' }}>
          <div className="container flex justify-between items-center">
            <a href="/" style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary)', letterSpacing: '-0.03em' }}>
              TSF<span style={{ color: 'var(--secondary)' }}>Store</span>
            </a>
            <div className="flex gap-4 items-center">
              <div style={{ display: 'flex', gap: '1rem' }} className="nav-links">
                <a href="/" style={{ fontWeight: 500 }}>Home</a>
                <a href="#featured" style={{ fontWeight: 500 }}>Shop</a>
                <a href="#deals" style={{ fontWeight: 500 }}>Deals</a>
              </div>
              <a href="#" className="btn-primary" style={{ padding: '8px 20px', borderRadius: '20px', fontSize: '0.9rem' }}>
                My Cart
              </a>
            </div>
          </div>
        </nav>

        {children}

        <footer style={{ background: 'var(--secondary)', color: 'white', padding: '4rem 0', marginTop: 'auto' }}>
          <div className="container grid grid-cols-3 gap-8">
            <div>
              <h3 style={{ color: 'white', marginBottom: '1rem' }}>TSF Store</h3>
              <p style={{ color: '#9CA3AF' }}>Bringing quality and freshness to your doorstep every single day.</p>
            </div>
            <div>
              <h4 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '1rem' }}>Customer Service</h4>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li><a href="#" style={{ color: '#D1D5DB' }}>Help Center</a></li>
                <li><a href="#" style={{ color: '#D1D5DB' }}>Returns & Refunds</a></li>
                <li><a href="#" style={{ color: '#D1D5DB' }}>Shipping Info</a></li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '1rem' }}>Newsletter</h4>
              <p style={{ color: '#D1D5DB', marginBottom: '1rem' }}>Subscribe for latest offers.</p>
              <div className="flex gap-2">
                <input type="email" placeholder="Your email" style={{ padding: '10px', borderRadius: '6px', border: 'none', width: '100%' }} />
                <button className="btn-primary" style={{ padding: '10px' }}>Go</button>
              </div>
            </div>
          </div>
          <div className="container text-center" style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #374151', color: '#6B7280' }}>
            &copy; {new Date().getFullYear()} TSF Supermarket. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
