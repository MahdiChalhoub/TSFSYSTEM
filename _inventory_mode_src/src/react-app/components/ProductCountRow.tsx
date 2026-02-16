import { CheckCircle, XCircle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  systemQty: number;
  person1Qty: number | null;
  person2Qty: number | null;
}

interface ProductCountRowProps {
  product: Product;
  onQuantityChange: (productId: string, person: 'person1' | 'person2', qty: number | null) => void;
}

export default function ProductCountRow({ product, onQuantityChange }: ProductCountRowProps) {
  const diff1 = product.person1Qty !== null ? product.person1Qty - product.systemQty : null;
  const diff2 = product.person2Qty !== null ? product.person2Qty - product.systemQty : null;
  const isMatch = diff1 !== null && diff2 !== null && diff1 === diff2;
  const bothCounted = product.person1Qty !== null && product.person2Qty !== null;

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-6 py-4">
        <div>
          <div className="font-medium text-slate-900">{product.name}</div>
          <div className="text-sm text-slate-500">{product.brand} • {product.category}</div>
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className="inline-flex items-center px-3 py-1 bg-slate-100 rounded-lg">
          <span className="font-semibold text-slate-900">{product.systemQty}</span>
          <span className="text-xs text-slate-500 ml-1">{product.unit}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <input
          type="number"
          value={product.person1Qty ?? ''}
          onChange={(e) => onQuantityChange(
            product.id,
            'person1',
            e.target.value ? parseInt(e.target.value) : null
          )}
          className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="0"
        />
      </td>
      <td className="px-6 py-4 text-center">
        <input
          type="number"
          value={product.person2Qty ?? ''}
          onChange={(e) => onQuantityChange(
            product.id,
            'person2',
            e.target.value ? parseInt(e.target.value) : null
          )}
          className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="0"
        />
      </td>
      <td className="px-6 py-4 text-center">
        {bothCounted && (
          <span className={`inline-flex items-center px-3 py-1 rounded-lg font-medium ${
            diff1 === 0 && diff2 === 0
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {diff1 !== null && diff1 > 0 ? '+' : ''}{diff1}
          </span>
        )}
      </td>
      <td className="px-6 py-4 text-center">
        {bothCounted && (
          isMatch ? (
            <CheckCircle className="w-6 h-6 text-green-500 mx-auto" />
          ) : (
            <XCircle className="w-6 h-6 text-red-500 mx-auto" />
          )
        )}
      </td>
    </tr>
  );
}
