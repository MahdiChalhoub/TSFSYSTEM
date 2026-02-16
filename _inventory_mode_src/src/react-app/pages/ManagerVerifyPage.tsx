import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Package, RefreshCw, Filter, ChevronLeft, ChevronRight, X, CheckCircle, Unlock, AlertTriangle, FileText, List } from 'lucide-react';

interface InventoryLine {
  id: number;
  session_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  product_unit_live: string;
  product_category_live: string;
  product_brand_live: string;
  product_margin_live: number;
  current_system_qty: number;
  system_qty: number;
  system_qty_person1: number | null;
  system_qty_person2: number | null;
  physical_qty_person1: number | null;
  physical_qty_person2: number | null;
  difference_person1: number | null;
  difference_person2: number | null;
  is_same_difference: number;
  needs_adjustment: number;
  is_verified: number;
  adjustment_status: string;
  counted_at_person1: string | null;
  counted_at_person2: string | null;
}

interface Session {
  id: number;
  location: string;
  section: string;
  person1_name: string;
  person2_name: string;
  status: string;
  assigned_users?: { user_id: number; user_name: string }[];
}

interface FilterOptions {
  categories: string[];
  brands: string[];
  units: string[];
  suppliers: { id: number; name: string }[];
}

interface AdjustmentOrder {
  id: number;
  session_id: number;
  created_by_user_name: string;
  status: string;
  item_count: number;
  done_count: number;
  created_at: string;
}

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'closed_by_person1', label: 'Counted by Person 1' },
  { value: 'closed_by_person2', label: 'Counted by Person 2' },
  { value: 'closed_by_both', label: 'Counted by Both' },
  { value: 'not_closed_by_both', label: 'Not Counted by Both' },
  { value: 'different_counts', label: 'Different Counts' },
  { value: 'finish', label: 'Finished (Match & Zero)' },
  { value: 'verified', label: 'Verified' },
  { value: 'not_verified', label: 'Not Verified' },
];

const ADJUSTMENT_OPTIONS = [
  { value: '', label: 'All Adjustment' },
  { value: 'needs_adjustment', label: 'Needs Adjustment' },
  { value: 'no_adjustment', label: 'No Adjustment Needed' },
  { value: 'pending', label: 'Adjustment Pending' },
  { value: 'order_created', label: 'Order Created' },
  { value: 'done', label: 'Adjustment Done' },
];

export default function ManagerVerifyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [lines, setLines] = useState<InventoryLine[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [adjustmentFilter, setAdjustmentFilter] = useState('');
  
  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  // Adjustment orders sidebar
  const [showOrdersSidebar, setShowOrdersSidebar] = useState(false);
  const [adjustmentOrders, setAdjustmentOrders] = useState<AdjustmentOrder[]>([]);

  useEffect(() => {
    fetchSession();
    fetchFilterOptions();
    fetchAdjustmentOrders();
  }, [id]);

  useEffect(() => {
    fetchLines();
  }, [id, offset, searchTerm, categoryFilter, brandFilter, unitFilter, supplierFilter, statusFilter, adjustmentFilter]);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/inventory-sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data);
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const res = await fetch(`/api/inventory-sessions/${id}/filter-options`);
      if (res.ok) {
        const data = await res.json();
        setFilterOptions(data);
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const fetchAdjustmentOrders = async () => {
    try {
      const res = await fetch(`/api/inventory-sessions/${id}/adjustment-orders`);
      if (res.ok) {
        const data = await res.json();
        setAdjustmentOrders(data);
      }
    } catch (error) {
      console.error('Failed to fetch adjustment orders:', error);
    }
  };

  const fetchLines = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: offset.toString(),
      });
      
      if (searchTerm) params.set('search', searchTerm);
      if (categoryFilter) params.set('category', categoryFilter);
      if (brandFilter) params.set('brand', brandFilter);
      if (unitFilter) params.set('unit', unitFilter);
      if (supplierFilter) params.set('supplier_id', supplierFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (adjustmentFilter) params.set('adjustment', adjustmentFilter);
      
      const res = await fetch(`/api/inventory-sessions/${id}/lines?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLines(data.lines);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch inventory lines:', error);
    } finally {
      setLoading(false);
    }
  }, [id, offset, searchTerm, categoryFilter, brandFilter, unitFilter, supplierFilter, statusFilter, adjustmentFilter]);

  const handleVerify = async (lineId: number) => {
    try {
      const res = await fetch(`/api/lines/${lineId}/verify`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setLines(lines.map(l => l.id === lineId ? { ...l, is_verified: 1 } : l));
      }
    } catch (error) {
      console.error('Failed to verify line:', error);
    }
  };

  const handleUnverify = async (lineId: number) => {
    try {
      const res = await fetch(`/api/lines/${lineId}/unverify`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setLines(lines.map(l => l.id === lineId ? { ...l, is_verified: 0 } : l));
      }
    } catch (error) {
      console.error('Failed to unverify line:', error);
    }
  };

  const handleUnlock = async (lineId: number, personNumber: number) => {
    if (!confirm(`Unlock this item for Person ${personNumber} to recount?`)) return;
    
    try {
      const res = await fetch(`/api/lines/${lineId}/unlock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_number: personNumber })
      });
      if (res.ok) {
        fetchLines(); // Refresh to get updated data
      }
    } catch (error) {
      console.error('Failed to unlock line:', error);
    }
  };

  const handleAdjustmentStatus = async (lineId: number, status: string) => {
    try {
      const res = await fetch(`/api/lines/${lineId}/adjustment-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment_status: status })
      });
      if (res.ok) {
        setLines(lines.map(l => l.id === lineId ? { ...l, adjustment_status: status } : l));
      }
    } catch (error) {
      console.error('Failed to update adjustment status:', error);
    }
  };

  const handleBulkVerify = async () => {
    if (selectedIds.size === 0) return;
    
    for (const lineId of selectedIds) {
      await handleVerify(lineId);
    }
    setSelectedIds(new Set());
  };

  const handleBulkCreateAdjustmentOrder = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const res = await fetch(`/api/inventory-sessions/${id}/adjustment-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_ids: Array.from(selectedIds) })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Adjustment order #${data.order_id} created for ${data.item_count} item${data.item_count !== 1 ? 's' : ''}.`);
        setSelectedIds(new Set());
        fetchLines();
        fetchAdjustmentOrders();
        setShowOrdersSidebar(true);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create adjustment order');
      }
    } catch (error) {
      console.error('Failed to create adjustment order:', error);
      alert('Failed to create adjustment order');
    }
  };

  const handleBulkMarkAdjustmentDone = async () => {
    if (selectedIds.size === 0) return;
    
    let updatedCount = 0;
    for (const lineId of selectedIds) {
      const line = lines.find(l => l.id === lineId);
      if (line && line.needs_adjustment === 1) {
        await handleAdjustmentStatus(lineId, 'DONE');
        updatedCount++;
      }
    }
    
    alert(`Marked ${updatedCount} adjustment${updatedCount !== 1 ? 's' : ''} as done.`);
    setSelectedIds(new Set());
    fetchLines();
  };

  const toggleSelect = (lineId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(lineId)) {
      newSelected.delete(lineId);
    } else {
      newSelected.add(lineId);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === lines.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(lines.map(l => l.id)));
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setBrandFilter('');
    setUnitFilter('');
    setSupplierFilter('');
    setStatusFilter('');
    setAdjustmentFilter('');
    setOffset(0);
  };

  const hasActiveFilters = searchTerm || categoryFilter || brandFilter || unitFilter || supplierFilter || statusFilter || adjustmentFilter;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const getPerson1Name = () => {
    if (session?.assigned_users?.[0]) return session.assigned_users[0].user_name;
    return session?.person1_name || 'Person 1';
  };

  const getPerson2Name = () => {
    if (session?.assigned_users?.[1]) return session.assigned_users[1].user_name;
    return session?.person2_name || 'Person 2';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Adjustment Orders Sidebar */}
      {showOrdersSidebar && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowOrdersSidebar(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl">
            <div className="h-full flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Adjustment Orders</h2>
                <button onClick={() => setShowOrdersSidebar(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {adjustmentOrders.length === 0 ? (
                  <div className="text-center text-slate-500 py-8">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No adjustment orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adjustmentOrders.map(order => (
                      <div key={order.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-slate-900">Order #{order.id}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-slate-600">
                          <p>Items: {order.item_count}</p>
                          <p>Done: {order.done_count} / {order.item_count}</p>
                          {order.created_by_user_name && <p className="text-xs">By: {order.created_by_user_name}</p>}
                        </div>
                        <button
                          onClick={() => navigate(`/adjustment-orders/${order.id}`)}
                          className="mt-3 w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                        >
                          View Details
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-3 sm:mb-4 transition-colors text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            Back to Sessions
          </button>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-1">
                Manager Verification
              </h1>
              <p className="text-xs sm:text-sm text-slate-600">
                Session #{id} • {session?.location}, {session?.section}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowOrdersSidebar(!showOrdersSidebar)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <List className="w-5 h-5" />
                Orders ({adjustmentOrders.length})
              </button>
              <button
                onClick={() => fetchLines()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-slate-200/50">
              <p className="text-sm text-slate-600">Total Products</p>
              <p className="text-2xl font-bold text-slate-900">{total}</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-slate-200/50">
              <p className="text-sm text-slate-600">Selected</p>
              <p className="text-2xl font-bold text-blue-600">{selectedIds.size}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-slate-200/50 mb-6">
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setOffset(0); }}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Status Filters - Always visible */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm min-w-[160px]"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            
            <select
              value={adjustmentFilter}
              onChange={(e) => { setAdjustmentFilter(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm min-w-[160px]"
            >
              {ADJUSTMENT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-5 h-5" />
              More
            </button>
          </div>

          {showFilters && filterOptions && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-200">
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setOffset(0); }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
              >
                <option value="">All Categories</option>
                {filterOptions.categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              
              <select
                value={brandFilter}
                onChange={(e) => { setBrandFilter(e.target.value); setOffset(0); }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
              >
                <option value="">All Brands</option>
                {filterOptions.brands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
              
              <select
                value={unitFilter}
                onChange={(e) => { setUnitFilter(e.target.value); setOffset(0); }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
              >
                <option value="">All Units</option>
                {filterOptions.units.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
              
              <select
                value={supplierFilter}
                onChange={(e) => { setSupplierFilter(e.target.value); setOffset(0); }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
              >
                <option value="">All Suppliers</option>
                {filterOptions.suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
              
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-blue-700 font-medium">{selectedIds.size} items selected</span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors text-sm"
              >
                Clear Selection
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleBulkVerify}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Verify Selected
              </button>
              <button
                onClick={handleBulkCreateAdjustmentOrder}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
              >
                Create Adjustment Order
              </button>
              <button
                onClick={handleBulkMarkAdjustmentDone}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
              >
                Mark Adjustment Done
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : lines.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === lines.length && lines.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700">Product</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-700">System</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-700 bg-blue-50/50">
                      <div>{getPerson1Name()}</div>
                      <div className="text-[10px] font-normal text-slate-500">Sys | Phys | Diff</div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-700 bg-purple-50/50">
                      <div>{getPerson2Name()}</div>
                      <div className="text-[10px] font-normal text-slate-500">Sys | Phys | Diff</div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-700">Status</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line) => (
                    <VerifyRow
                      key={line.id}
                      line={line}
                      selected={selectedIds.has(line.id)}
                      onToggleSelect={() => toggleSelect(line.id)}
                      onVerify={() => handleVerify(line.id)}
                      onUnverify={() => handleUnverify(line.id)}
                      onUnlock={handleUnlock}
                      onAdjustmentStatus={handleAdjustmentStatus}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VerifyRow({ 
  line, 
  selected,
  onToggleSelect,
  onVerify,
  onUnverify,
  onUnlock,
  onAdjustmentStatus
}: { 
  line: InventoryLine;
  selected: boolean;
  onToggleSelect: () => void;
  onVerify: () => void;
  onUnverify: () => void;
  onUnlock: (lineId: number, personNumber: number) => void;
  onAdjustmentStatus: (lineId: number, status: string) => void;
}) {
  const hasDifferentCounts = line.difference_person1 !== null && 
                             line.difference_person2 !== null && 
                             line.difference_person1 !== line.difference_person2;
  
  const isComplete = line.physical_qty_person1 !== null && line.physical_qty_person2 !== null;
  const needsAdjustment = line.needs_adjustment === 1;

  const getStatusBadge = () => {
    if (line.is_verified) {
      return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Verified</span>;
    }
    if (hasDifferentCounts) {
      return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Different</span>;
    }
    if (isComplete && line.is_same_difference && line.difference_person1 === 0) {
      return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Match</span>;
    }
    if (isComplete) {
      return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Complete</span>;
    }
    return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">Pending</span>;
  };

  const getAdjustmentBadge = () => {
    if (!needsAdjustment) return null;
    
    switch (line.adjustment_status) {
      case 'DONE':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Done</span>;
      case 'ORDER_CREATED':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">Order</span>;
      default:
        return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">Adjust</span>;
    }
  };

  const formatDiff = (diff: number | null) => {
    if (diff === null) return '—';
    if (diff === 0) return <span className="text-green-600 font-medium">0</span>;
    if (diff > 0) return <span className="text-blue-600 font-medium">+{diff}</span>;
    return <span className="text-red-600 font-medium">{diff}</span>;
  };

  return (
    <tr className={`hover:bg-slate-50 transition-colors ${hasDifferentCounts ? 'bg-red-50/30' : ''}`}>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      </td>
      <td className="px-3 py-3">
        <div>
          <p className="font-medium text-slate-900 text-sm">{line.product_name}</p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {line.sku && <span>SKU: {line.sku}</span>}
            {line.product_category_live && <span>• {line.product_category_live}</span>}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-center text-sm text-slate-600">
        {line.current_system_qty}
      </td>
      <td className="px-3 py-3 text-center bg-blue-50/30">
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="text-slate-500">{line.system_qty_person1 ?? '—'}</span>
          <span className="text-slate-400">|</span>
          <span className={line.physical_qty_person1 !== null ? 'font-medium text-slate-900' : 'text-slate-400'}>
            {line.physical_qty_person1 ?? '—'}
          </span>
          <span className="text-slate-400">|</span>
          {formatDiff(line.difference_person1)}
        </div>
        {line.physical_qty_person1 !== null && (
          <button
            onClick={() => onUnlock(line.id, 1)}
            className="mt-1 text-[10px] text-orange-600 hover:text-orange-700 flex items-center gap-1 mx-auto"
          >
            <Unlock className="w-3 h-3" /> Unlock
          </button>
        )}
      </td>
      <td className="px-3 py-3 text-center bg-purple-50/30">
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="text-slate-500">{line.system_qty_person2 ?? '—'}</span>
          <span className="text-slate-400">|</span>
          <span className={line.physical_qty_person2 !== null ? 'font-medium text-slate-900' : 'text-slate-400'}>
            {line.physical_qty_person2 ?? '—'}
          </span>
          <span className="text-slate-400">|</span>
          {formatDiff(line.difference_person2)}
        </div>
        {line.physical_qty_person2 !== null && (
          <button
            onClick={() => onUnlock(line.id, 2)}
            className="mt-1 text-[10px] text-orange-600 hover:text-orange-700 flex items-center gap-1 mx-auto"
          >
            <Unlock className="w-3 h-3" /> Unlock
          </button>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        <div className="flex flex-col items-center gap-1">
          {getStatusBadge()}
          {getAdjustmentBadge()}
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            {!line.is_verified ? (
              <button
                onClick={onVerify}
                className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-xs font-medium flex items-center gap-1"
                title="Verify"
              >
                <CheckCircle className="w-3 h-3" />
                Verify
              </button>
            ) : (
              <button
                onClick={onUnverify}
                className="px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors text-xs font-medium flex items-center gap-1"
                title="Unverify"
              >
                <X className="w-3 h-3" />
                Unverify
              </button>
            )}
          </div>
          {needsAdjustment && (
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] text-slate-500">Adjustment:</span>
              <select
                value={line.adjustment_status || 'PENDING'}
                onChange={(e) => onAdjustmentStatus(line.id, e.target.value)}
                className="text-xs px-2 py-1 border border-slate-200 rounded bg-white w-full"
              >
                <option value="PENDING">Pending</option>
                <option value="ORDER_CREATED">Order Created</option>
                <option value="DONE">Done</option>
              </select>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
