import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Package, RefreshCw, Filter, ChevronLeft, ChevronRight, X, CheckCircle, Lock, AlertTriangle, Circle } from 'lucide-react';
import MicroSectionsManager from '../components/MicroSectionsManager';
import ProductCountCard from '../components/ProductCountCard';
import { useAuth } from '@getmocha/users-service/react';

interface InventoryLine {
  id: number;
  session_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  unit: string;
  category: string;
  brand: string;
  margin: number;
  system_qty: number | null;
  physical_qty: number | null;
  difference: number | null;
  current_system_qty: number;
  counted_at: string | null;
}

interface Session {
  id: number;
  location: string;
  section: string;
  status: string;
  assigned_users?: { user_id: number; user_name: string }[];
}

interface FilterOptions {
  categories: string[];
  brands: string[];
  units: string[];
  suppliers: { id: number; name: string }[];
}

const PAGE_SIZE = 50;

export default function CountingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [lines, setLines] = useState<InventoryLine[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedLine, setSelectedLine] = useState<InventoryLine | null>(null);
  
  // Pagination
  const [total, setTotal] = useState(0);
  const [counted, setCounted] = useState(0);
  const [offset, setOffset] = useState(0);
  
  // Filters
  const [showFilters, setShowFilters] = useState(true);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [uncountedOnly, setUncountedOnly] = useState(false);
  const [qtyFilter, setQtyFilter] = useState('');
  const [qtyMin, setQtyMin] = useState('');
  const [qtyMax, setQtyMax] = useState('');
  
  // Current user's person number (1 or 2)
  const [personNumber, setPersonNumber] = useState<number | null>(null);

  useEffect(() => {
    fetchSession();
    fetchFilterOptions();
  }, [id]);

  useEffect(() => {
    if (personNumber !== null) {
      fetchLines();
    }
  }, [id, personNumber, selectedSectionId, offset, searchTerm, categoryFilter, brandFilter, unitFilter, supplierFilter, uncountedOnly, qtyFilter, qtyMin, qtyMax]);

  // Auto-open card when search returns single result
  useEffect(() => {
    if (searchTerm && lines.length === 1 && !selectedLine) {
      setSelectedLine(lines[0]);
    }
  }, [lines, searchTerm]);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/inventory-sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        
        // Determine which person number the current user is
        if (data.assigned_users && user) {
          const userIndex = data.assigned_users.findIndex(
            (u: any) => u.user_id === user.id || u.user_name === user.google_user_data?.name
          );
          if (userIndex !== -1) {
            setPersonNumber(userIndex + 1); // 1-based
          } else {
            // User not assigned - default to person 1 for viewing
            setPersonNumber(1);
          }
        } else {
          setPersonNumber(1);
        }
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
      setPersonNumber(1); // Default
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

  const fetchLines = useCallback(async () => {
    if (personNumber === null) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        person_number: personNumber.toString(),
        limit: PAGE_SIZE.toString(),
        offset: offset.toString(),
      });
      
      // Don't pass micro_section_id for filter-based sections - just use the filters
      // if (selectedSectionId !== null) {
      //   params.set('micro_section_id', selectedSectionId.toString());
      // }
      if (searchTerm) params.set('search', searchTerm);
      if (categoryFilter) params.set('category', categoryFilter);
      if (brandFilter) params.set('brand', brandFilter);
      if (unitFilter) params.set('unit', unitFilter);
      if (supplierFilter) params.set('supplier_id', supplierFilter);
      if (uncountedOnly) params.set('uncounted_only', 'true');
      if (qtyFilter) params.set('qty_filter', qtyFilter);
      if (qtyFilter === 'custom' && qtyMin) params.set('qty_min', qtyMin);
      if (qtyFilter === 'custom' && qtyMax) params.set('qty_max', qtyMax);
      
      const res = await fetch(`/api/inventory-sessions/${id}/my-lines?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLines(data.lines);
        setTotal(data.total);
        setCounted(data.counted);
      }
    } catch (error) {
      console.error('Failed to fetch inventory lines:', error);
    } finally {
      setLoading(false);
    }
  }, [id, personNumber, selectedSectionId, offset, searchTerm, categoryFilter, brandFilter, unitFilter, supplierFilter, uncountedOnly, qtyFilter, qtyMin, qtyMax]);

  const handleSubmitCount = async (lineId: number, qty: number, systemQtyOverride?: number) => {
    if (personNumber === null) return;
    
    try {
      const res = await fetch(`/api/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          physical_qty: qty,
          person_number: personNumber,
          system_qty_override: systemQtyOverride
        })
      });

      if (res.ok) {
        await fetchLines(); // Refresh the list
        setSelectedLine(null);
      }
    } catch (error) {
      console.error('Failed to submit count:', error);
      throw error;
    }
  };

  const handleCompleteSession = async () => {
    if (!confirm('Mark this session as waiting for verification?')) return;

    try {
      const res = await fetch(`/api/inventory-sessions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'WAITING_VERIFICATION' })
      });

      if (res.ok) {
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to update session status:', error);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setBrandFilter('');
    setUnitFilter('');
    setSupplierFilter('');
    setUncountedOnly(false);
    setQtyFilter('');
    setQtyMin('');
    setQtyMax('');
    setOffset(0);
  };

  const hasActiveFilters = searchTerm || categoryFilter || brandFilter || unitFilter || supplierFilter || uncountedOnly || qtyFilter;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const progress = total > 0 ? (counted / total) * 100 : 0;

  const getPersonName = () => {
    if (session?.assigned_users && personNumber) {
      const assignment = session.assigned_users[personNumber - 1];
      return assignment?.user_name || `Person ${personNumber}`;
    }
    return user?.google_user_data?.name || 'You';
  };

  if (personNumber === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
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
                Inventory Counting
              </h1>
              <p className="text-xs sm:text-sm text-slate-600">
                Session #{id} • {session?.location}, {session?.section}
                <br className="sm:hidden" />
                <span className="hidden sm:inline"> • </span>
                Counting as <span className="font-semibold text-blue-600">{getPersonName()}</span>
              </p>
            </div>
            <button
              onClick={() => fetchLines()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Progress */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-slate-200/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-slate-700">
                  {counted} of {total} products counted
                </span>
              </div>
              <span className="text-xl font-bold text-slate-900">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Micro-sections sidebar */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <MicroSectionsManager
              sessionId={parseInt(id || '0')}
              selectedSectionId={selectedSectionId}
              onSelectSection={(sectionId, filters) => {
                setSelectedSectionId(sectionId);
                // Apply filters from micro-section
                if (filters) {
                  if (filters.supplier_id) setSupplierFilter(filters.supplier_id);
                  else setSupplierFilter('');
                  
                  if (filters.category) setCategoryFilter(filters.category);
                  else setCategoryFilter('');
                  
                  if (filters.brand) setBrandFilter(filters.brand);
                  else setBrandFilter('');
                  
                  if (filters.unit) setUnitFilter(filters.unit);
                  else setUnitFilter('');
                  
                  if (filters.qty_filter) {
                    setQtyFilter(filters.qty_filter);
                    if (filters.qty_filter === 'custom') {
                      if (filters.qty_min) setQtyMin(filters.qty_min);
                      if (filters.qty_max) setQtyMax(filters.qty_max);
                    }
                  } else {
                    setQtyFilter('');
                    setQtyMin('');
                    setQtyMax('');
                  }
                  
                  if (filters.uncounted_only === 'true') setUncountedOnly(true);
                  else setUncountedOnly(false);
                } else {
                  // Clear all filters when no section selected
                  clearFilters();
                }
                setOffset(0);
              }}
            />
          </div>

          {/* Main content */}
          <div className="lg:col-span-3 space-y-3 sm:space-y-4 order-1 lg:order-2">
            {/* Search and Filters */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-slate-200/50">
              <div className="flex gap-3 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setOffset(0); }}
                    placeholder="Search products..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                    showFilters || hasActiveFilters
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  Filters
                  {hasActiveFilters && <span className="w-2 h-2 bg-blue-600 rounded-full"></span>}
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
                  
                  <select
                    value={qtyFilter}
                    onChange={(e) => { setQtyFilter(e.target.value); setOffset(0); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">All Quantities</option>
                    <option value="zero">Zero Qty (0)</option>
                    <option value="non_zero">Non-Zero Qty</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  
                  {qtyFilter === 'custom' && (
                    <>
                      <input
                        type="number"
                        value={qtyMin}
                        onChange={(e) => { setQtyMin(e.target.value); setOffset(0); }}
                        placeholder="Min qty"
                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                      <input
                        type="number"
                        value={qtyMax}
                        onChange={(e) => { setQtyMax(e.target.value); setOffset(0); }}
                        placeholder="Max qty"
                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </>
                  )}
                  
                  <label className="flex items-center gap-2 col-span-2">
                    <input
                      type="checkbox"
                      checked={uncountedOnly}
                      onChange={(e) => { setUncountedOnly(e.target.checked); setOffset(0); }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-600">Show uncounted only</span>
                  </label>
                  
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Products List */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : lines.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No products found</p>
                  <p className="text-sm">
                    {hasActiveFilters 
                      ? 'Try adjusting your filters'
                      : 'Add products to this inventory session to start counting'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {lines.map((line) => (
                    <ProductListItem
                      key={line.id}
                      line={line}
                      onClick={() => setSelectedLine(line)}
                    />
                  ))}
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

            {/* Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
              <button 
                onClick={() => navigate('/')}
                className="px-4 sm:px-6 py-2.5 sm:py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm sm:text-base"
              >
                Save & Exit
              </button>
              <button 
                onClick={handleCompleteSession}
                disabled={session?.status !== 'IN_PROGRESS'}
                className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                Complete Counting
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Count Card Modal */}
      {selectedLine && session && (
        <ProductCountCard
          line={selectedLine}
          session={session}
          personName={getPersonName()}
          onClose={() => setSelectedLine(null)}
          onSubmit={handleSubmitCount}
        />
      )}
    </div>
  );
}

// Product list item component
function ProductListItem({ 
  line, 
  onClick 
}: { 
  line: InventoryLine; 
  onClick: () => void;
}) {
  const isCounted = line.physical_qty !== null;
  const isLocked = isCounted && line.counted_at !== null;
  const needsAdjustment = line.difference !== null && line.difference !== 0;

  return (
    <button
      onClick={onClick}
      className="w-full p-4 hover:bg-slate-50 transition-colors text-left group"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left side - Product info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
              {line.product_name}
            </h3>
            
            {/* Status badges */}
            <div className="flex items-center gap-2">
              {!isCounted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                  <Circle className="w-3 h-3" />
                  Not Counted
                </span>
              )}
              
              {isCounted && !isLocked && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  <CheckCircle className="w-3 h-3" />
                  Draft
                </span>
              )}
              
              {isLocked && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  <Lock className="w-3 h-3" />
                  Locked
                </span>
              )}
              
              {needsAdjustment && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Needs Adjustment
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-sm text-slate-500 mb-2">
            {line.sku && <span>SKU: {line.sku}</span>}
            {line.category && <span>• {line.category}</span>}
            {line.brand && <span>• {line.brand}</span>}
            <span>• {line.unit}</span>
          </div>
          
          {/* Quantity info row */}
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-slate-500">System: </span>
              <span className="font-semibold text-slate-700">{line.system_qty !== null ? line.system_qty : line.current_system_qty}</span>
            </div>
            
            {isCounted && (
              <>
                <div>
                  <span className="text-slate-500">Your Count: </span>
                  <span className="font-bold text-slate-900">{line.physical_qty}</span>
                </div>
                
                {line.difference !== null && (
                  <div>
                    <span className="text-slate-500">Difference: </span>
                    <span className={`font-bold ${
                      line.difference === 0 
                        ? 'text-green-600' 
                        : line.difference > 0 
                          ? 'text-blue-600' 
                          : 'text-red-600'
                    }`}>
                      {line.difference > 0 ? '+' : ''}{line.difference}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Right side - Arrow */}
        <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-slate-600 rotate-180 flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}
