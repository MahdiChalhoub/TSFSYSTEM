import Link from 'next/link';
import { prisma } from "@/lib/db";

async function getProducts() {
    return await prisma.product.findMany({
        include: {
            category: true,
            inventory: true // See stock levels
        },
        orderBy: { id: 'desc' }
    });
}

export default async function ProductsPage() {
    const products = await getProducts();

    return (
        <div>
            <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--secondary)' }}>Product Registry</h1>
                    <p style={{ color: '#6B7280' }}>Manage catalog, pricing, and stock settings.</p>
                </div>
                <Link href="/admin/products/new" className="btn-primary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', textDecoration: 'none' }}>
                    <span>+</span> New Product
                </Link>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Information</th>
                            <th>SKU / Barcode</th>
                            <th>Price (Base)</th>
                            <th>Tax</th>
                            <th>Stock</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(p => (
                            <tr key={p.id}>
                                <td>
                                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>{p.category?.name || 'Uncategorized'}</div>
                                </td>
                                <td>
                                    <div className="status-badge status-info">{p.sku}</div>
                                    <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>{p.barcode}</div>
                                </td>
                                <td>${Number(p.basePrice).toFixed(2)}</td>
                                <td>
                                    {Number(p.taxRate) * 100}%
                                    {p.isTaxIncluded && <span style={{ fontSize: '0.7rem', display: 'block', color: '#059669' }}>(Inc)</span>}
                                </td>
                                <td>
                                    {/* Summing up inventory across all warehouses just for display */}
                                    {p.inventory.reduce((acc, inv) => acc + Number(inv.quantity), 0)} units
                                </td>
                                <td>
                                    <button style={{ color: '#4F46E5', marginRight: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
                                    <button style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
