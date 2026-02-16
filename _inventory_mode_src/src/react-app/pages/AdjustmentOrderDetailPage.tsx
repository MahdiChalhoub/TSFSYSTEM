import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Package, Calendar, User, CheckCircle, Clock, PlayCircle } from 'lucide-react';

interface InventoryLine {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  product_unit_live: string;
  product_category_live: string;
  product_brand_live: string;
  current_system_qty: number;
  system_qty_person1: number | null;
  system_qty_person2: number | null;
  physical_qty_person1: number | null;
  physical_qty_person2: number | null;
  difference_person1: number | null;
  difference_person2: number | null;
  adjustment_status: string;
}

interface AdjustmentOrder {
  id: number;
  session_id: number;
  created_by_user_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Session {
  id: number;
  location: string;
  section: string;
  session_date: string;
}

export default function AdjustmentOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<AdjustmentOrder | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [lines, setLines] = useState<InventoryLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrderData();
  }, [id]);

  async function loadOrderData() {
    try {
      setLoading(true);
      
      // Get order lines
      const linesRes = await fetch(`/api/adjustment-orders/${id}/lines`);
      const linesData = await linesRes.json();
      setLines(linesData);
      
      // Get session info from first line if available
      if (linesData.length > 0) {
        const sessionId = linesData[0].session_id;
        const sessionRes = await fetch(`/api/inventory-sessions/${sessionId}`);
        const sessionData = await sessionRes.json();
        setSession(sessionData);
        
        // Get all adjustment orders to find this one
        const ordersRes = await fetch(`/api/inventory-sessions/${sessionId}/adjustment-orders`);
        const ordersData = await ordersRes.json();
        const thisOrder = ordersData.find((o: AdjustmentOrder) => o.id === parseInt(id!));
        setOrder(thisOrder);
      }
    } catch (error) {
      console.error('Failed to load order data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  const handleStartOrder = async () => {
    if (order?.status === 'PENDING') {
      try {
        await fetch(`/api/adjustment-orders/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'IN_PROGRESS' })
        });
        await loadOrderData();
      } catch (error) {
        console.error('Failed to start order:', error);
        alert('Failed to start order');
      }
    }
  };

  const handleCompleteOrder = async () => {
    const adminCode = prompt('Enter admin code to complete this order:');
    if (!adminCode) return;

    try {
      const response = await fetch(`/api/adjustment-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', admin_code: adminCode })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to complete order');
        return;
      }

      await loadOrderData();
    } catch (error) {
      console.error('Failed to complete order:', error);
      alert('Failed to complete order');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium print:border print:border-yellow-600">
            <Clock className="w-4 h-4" />
            Pending
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium print:border print:border-blue-600">
            <Clock className="w-4 h-4" />
            In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium print:border print:border-green-600">
            <CheckCircle className="w-4 h-4" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  const getAdjustmentQty = (line: InventoryLine) => {
    // Use person 1's difference if available, otherwise person 2's
    return line.difference_person1 ?? line.difference_person2 ?? 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!order || !session) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xl text-slate-600">Order not found</p>
          <button
            onClick={() => navigate('/adjustment-orders')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 print:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header - hide back button and print button when printing */}
        <div className="mb-6 print:mb-4">
          <div className="flex items-center justify-between mb-4 print:hidden">
            <button
              onClick={() => navigate('/adjustment-orders')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Orders
            </button>
            <div className="flex items-center gap-3">
              {order.status === 'PENDING' && (
                <button
                  onClick={handleStartOrder}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <PlayCircle className="w-5 h-5" />
                  Start Order
                </button>
              )}
              {order.status !== 'COMPLETED' && (
                <button
                  onClick={handleCompleteOrder}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  Complete Order
                </button>
              )}
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Printer className="w-5 h-5" />
                Print
              </button>
            </div>
          </div>

          {/* Print-only company header */}
          <div className="hidden print:block mb-8 pb-4 border-b-2 border-slate-900">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Inventory Adjustment Order</h1>
            <p className="text-lg text-slate-700">Document #{order.id}</p>
          </div>

          {/* Order Header */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-slate-200/50 print:shadow-none print:border-2 print:border-slate-900 print:mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 print:text-xl">
                  Adjustment Order #{order.id}
                </h1>
                <p className="text-slate-600 print:text-slate-900 print:font-medium">
                  {session.location} - {session.section}
                </p>
              </div>
              {getStatusBadge(order.status)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 print:border-slate-900">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-400 print:hidden" />
                <div>
                  <p className="text-xs text-slate-500 print:text-slate-700 print:font-semibold print:text-sm">Session Date</p>
                  <p className="font-medium text-slate-900 print:text-base">
                    {new Date(session.session_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-400 print:hidden" />
                <div>
                  <p className="text-xs text-slate-500 print:text-slate-700 print:font-semibold print:text-sm">Order Created</p>
                  <p className="font-medium text-slate-900 print:text-base">
                    {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              {order.created_by_user_name && (
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-slate-400 print:hidden" />
                  <div>
                    <p className="text-xs text-slate-500 print:text-slate-700 print:font-semibold print:text-sm">Created By</p>
                    <p className="font-medium text-slate-900 print:text-base">{order.created_by_user_name}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 print:border-slate-900">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-slate-400 print:hidden" />
                <div>
                  <p className="text-xs text-slate-500 print:text-slate-700 print:font-semibold print:text-sm">Total Items</p>
                  <p className="text-2xl font-bold text-slate-900 print:text-xl">{lines.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 overflow-hidden print:shadow-none print:border-2 print:border-slate-900 print:overflow-visible">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full print:border-collapse print:table-fixed">
              <colgroup className="print:block hidden">
                <col style={{ width: '4%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '7%' }} />
              </colgroup>
              <thead className="bg-slate-50 border-b-2 border-slate-200 print:bg-slate-100 print:border-b-2 print:border-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 print:text-black print:border print:border-slate-900 print:px-2 print:py-2 print:text-xs">#</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 print:text-black print:border print:border-slate-900 print:px-2 print:py-2 print:text-xs">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 print:text-black print:border print:border-slate-900 print:px-2 print:py-2 print:text-xs">SKU</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 print:text-black print:border print:border-slate-900 print:px-2 print:py-2 print:text-xs">Category</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 print:text-black print:border print:border-slate-900 print:px-2 print:py-2 print:text-xs">Unit</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 print:text-black print:border print:border-slate-900 print:px-2 print:py-2 print:text-xs">System Qty</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 print:text-black print:border print:border-slate-900 print:px-2 print:py-2 print:text-xs">Physical Qty</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 print:text-black print:border print:border-slate-900 print:px-2 print:py-2 print:text-xs">Adjustment</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 print:hidden">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 print:table-cell hidden print:text-black print:border print:border-slate-900 print:px-2 print:py-2 print:text-xs">Done</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, index) => {
                  const adjustmentQty = getAdjustmentQty(line);
                  const systemQty = line.system_qty_person1 ?? line.system_qty_person2 ?? 0;
                  const physicalQty = line.physical_qty_person1 ?? line.physical_qty_person2 ?? 0;
                  
                  return (
                    <tr key={line.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                      <td className="px-4 py-3 text-slate-600 print:text-black print:border print:border-slate-900 print:px-2 print:py-1 print:text-xs">{index + 1}</td>
                      <td className="px-4 py-3 print:border print:border-slate-900 print:px-2 print:py-1">
                        <p className="font-medium text-slate-900 print:text-black print:text-xs print:leading-tight">{line.product_name}</p>
                        {line.product_brand_live && (
                          <p className="text-xs text-slate-500 print:text-slate-700 print:text-[10px]">{line.product_brand_live}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 print:text-black print:border print:border-slate-900 print:px-2 print:py-1 print:text-xs">{line.sku || '—'}</td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600 print:text-black print:border print:border-slate-900 print:px-2 print:py-1 print:text-xs">
                        {line.product_category_live || '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600 print:text-black print:border print:border-slate-900 print:px-2 print:py-1 print:text-xs">
                        {line.product_unit_live || '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-slate-900 print:text-black print:border print:border-slate-900 print:px-2 print:py-1 print:text-xs">
                        {systemQty}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-slate-900 print:text-black print:border print:border-slate-900 print:px-2 print:py-1 print:text-xs">
                        {physicalQty}
                      </td>
                      <td className="px-4 py-3 text-center print:border print:border-slate-900 print:px-2 print:py-1">
                        <span className={`font-bold print:text-xs ${
                          adjustmentQty > 0 ? 'text-blue-600 print:text-black' :
                          adjustmentQty < 0 ? 'text-red-600 print:text-black' :
                          'text-green-600 print:text-black'
                        }`}>
                          {adjustmentQty > 0 ? '+' : ''}{adjustmentQty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center print:hidden">
                        {line.adjustment_status === 'DONE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <CheckCircle className="w-3 h-3" />
                            Done
                          </span>
                        ) : line.adjustment_status === 'ORDER_CREATED' ? (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                            Pending
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                            {line.adjustment_status || 'Pending'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center print:table-cell hidden print:border print:border-slate-900 print:px-2 print:py-1 print:text-sm">
                        {line.adjustment_status === 'DONE' ? '✓' : '☐'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 print:bg-slate-100 print:border-t-2 print:border-slate-900">
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-right font-semibold text-slate-700 print:text-black print:border print:border-slate-900 print:px-2 print:py-2 print:text-xs">
                    Total Items:
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900 print:text-black print:border print:border-slate-900 print:px-2 print:py-2 print:text-sm">
                    {lines.length}
                  </td>
                  <td colSpan={2} className="print:border print:border-slate-900"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Print footer */}
        <div className="hidden print:block mt-8 pt-4 border-t-2 border-slate-900">
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-2">Prepared By:</p>
              <div className="border-b border-slate-900 pb-8 mb-2"></div>
              <p className="text-xs text-slate-700">Signature & Date</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-2">Approved By:</p>
              <div className="border-b border-slate-900 pb-8 mb-2"></div>
              <p className="text-xs text-slate-700">Signature & Date</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 text-center">
            Document printed on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          body {
            background: white !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:block {
            display: block !important;
          }
          
          .print\\:table-cell {
            display: table-cell !important;
          }
          
          .print\\:border-2 {
            border-width: 2px !important;
          }
          
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          
          .print\\:p-8 {
            padding: 2rem !important;
          }
          
          .print\\:mb-4 {
            margin-bottom: 1rem !important;
          }
          
          /* Remove gradients and backgrounds for print */
          .bg-gradient-to-br,
          .bg-gradient-to-r,
          .backdrop-blur-sm {
            background: white !important;
          }
          
          /* Ensure proper page breaks */
          table {
            page-break-inside: auto;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          thead {
            display: table-header-group;
          }
          
          tfoot {
            display: table-footer-group;
          }
          
          /* Better borders for print */
          table,
          th,
          td {
            border-color: #000 !important;
          }
          
          @page {
            margin: 1cm;
            size: A4 landscape;
          }
          
          /* Header styling for print */
          h1 {
            color: #000 !important;
            background: none !important;
            -webkit-background-clip: unset !important;
            background-clip: unset !important;
          }
          
          /* Ensure status badges are visible */
          .bg-yellow-100 {
            background-color: #fef3c7 !important;
            border: 1px solid #f59e0b !important;
          }
          
          .bg-blue-100 {
            background-color: #dbeafe !important;
            border: 1px solid #3b82f6 !important;
          }
          
          .bg-green-100 {
            background-color: #d1fae5 !important;
            border: 1px solid #10b981 !important;
          }
          
          /* Remove rounded corners for cleaner look */
          * {
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
