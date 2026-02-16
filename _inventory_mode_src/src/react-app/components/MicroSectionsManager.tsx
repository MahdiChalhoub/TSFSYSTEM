import { useState, useEffect } from 'react';
import { Plus, Users, Package, ChevronRight, Filter, X } from 'lucide-react';

interface User {
  id: number;
  name: string;
  email: string;
}

interface MicroSection {
  id: number;
  name: string;
  status: string;
  assigned_users: { user_id: number; user_name: string }[];
  products_count: number;
  counted_count: number;
  filter_supplier_id: number | null;
  filter_category: string | null;
  filter_brand: string | null;
  filter_unit: string | null;
  filter_qty_type: string | null;
  filter_qty_min: number | null;
  filter_qty_max: number | null;
  filter_uncounted_only: boolean;
}

interface FilterOptions {
  categories: string[];
  brands: string[];
  units: string[];
  suppliers: { id: number; name: string }[];
}

interface MicroSectionsManagerProps {
  sessionId: number;
  onSelectSection: (sectionId: number | null, filters?: any) => void;
  selectedSectionId: number | null;
}

export default function MicroSectionsManager({ 
  sessionId, 
  onSelectSection,
  selectedSectionId 
}: MicroSectionsManagerProps) {
  const [sections, setSections] = useState<MicroSection[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  
  // Filter state for new section
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterQtyType, setFilterQtyType] = useState('');
  const [filterQtyMin, setFilterQtyMin] = useState('');
  const [filterQtyMax, setFilterQtyMax] = useState('');
  const [filterUncountedOnly, setFilterUncountedOnly] = useState(false);

  useEffect(() => {
    fetchSections();
    fetchUsers();
    fetchFilterOptions();
  }, [sessionId]);

  const fetchSections = async () => {
    try {
      const res = await fetch(`/api/inventory-sessions/${sessionId}/micro-sections`);
      if (res.ok) {
        const data = await res.json();
        setSections(data);
      }
    } catch (error) {
      console.error('Failed to fetch micro-sections:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const res = await fetch(`/api/inventory-sessions/${sessionId}/filter-options`);
      if (res.ok) {
        const data = await res.json();
        setFilterOptions(data);
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const handleAddSection = async () => {
    if (!newSectionName.trim()) return;

    const assigned_users = selectedUsers.map(userId => {
      const user = users.find(u => u.id === userId);
      return { user_id: userId, user_name: user?.name || user?.email || '' };
    });

    const filters: any = {};
    if (filterSupplier) filters.filter_supplier_id = parseInt(filterSupplier);
    if (filterCategory) filters.filter_category = filterCategory;
    if (filterBrand) filters.filter_brand = filterBrand;
    if (filterUnit) filters.filter_unit = filterUnit;
    if (filterQtyType) {
      filters.filter_qty_type = filterQtyType;
      if (filterQtyType === 'custom') {
        if (filterQtyMin) filters.filter_qty_min = parseInt(filterQtyMin);
        if (filterQtyMax) filters.filter_qty_max = parseInt(filterQtyMax);
      }
    }
    if (filterUncountedOnly) filters.filter_uncounted_only = true;

    try {
      const res = await fetch(`/api/inventory-sessions/${sessionId}/micro-sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSectionName, assigned_users, ...filters })
      });

      if (res.ok) {
        resetForm();
        fetchSections();
      }
    } catch (error) {
      console.error('Failed to create micro-section:', error);
    }
  };

  const resetForm = () => {
    setNewSectionName('');
    setSelectedUsers([]);
    setFilterSupplier('');
    setFilterCategory('');
    setFilterBrand('');
    setFilterUnit('');
    setFilterQtyType('');
    setFilterQtyMin('');
    setFilterQtyMax('');
    setFilterUncountedOnly(false);
    setShowAddForm(false);
  };

  const handleDeleteSection = async (id: number) => {
    if (!confirm('Delete this micro-section?')) return;

    try {
      await fetch(`/api/micro-sections/${id}`, { method: 'DELETE' });
      fetchSections();
      if (selectedSectionId === id) {
        onSelectSection(null);
      }
    } catch (error) {
      console.error('Failed to delete micro-section:', error);
    }
  };

  const handleSelectSection = (section: MicroSection | null) => {
    if (!section) {
      onSelectSection(null);
      return;
    }

    const filters: any = {};
    if (section.filter_supplier_id) filters.supplier_id = section.filter_supplier_id.toString();
    if (section.filter_category) filters.category = section.filter_category;
    if (section.filter_brand) filters.brand = section.filter_brand;
    if (section.filter_unit) filters.unit = section.filter_unit;
    if (section.filter_qty_type) {
      filters.qty_filter = section.filter_qty_type;
      if (section.filter_qty_type === 'custom') {
        if (section.filter_qty_min !== null) filters.qty_min = section.filter_qty_min.toString();
        if (section.filter_qty_max !== null) filters.qty_max = section.filter_qty_max.toString();
      }
    }
    if (section.filter_uncounted_only) filters.uncounted_only = 'true';

    onSelectSection(section.id, filters);
  };

  const getFilterSummary = (section: MicroSection) => {
    const parts: string[] = [];
    if (section.filter_supplier_id) {
      const supplier = filterOptions?.suppliers.find(s => s.id === section.filter_supplier_id);
      if (supplier) parts.push(supplier.name);
    }
    if (section.filter_category) parts.push(section.filter_category);
    if (section.filter_brand) parts.push(section.filter_brand);
    if (section.filter_unit) parts.push(section.filter_unit);
    if (section.filter_qty_type === 'zero') parts.push('Zero qty');
    if (section.filter_qty_type === 'non_zero') parts.push('Non-zero qty');
    if (section.filter_qty_type === 'custom') {
      const min = section.filter_qty_min ?? '?';
      const max = section.filter_qty_max ?? '?';
      parts.push(`Qty ${min}-${max}`);
    }
    if (section.filter_uncounted_only) parts.push('Uncounted');
    return parts.length > 0 ? parts.join(' • ') : 'No filters';
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-slate-200/50">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-slate-200 rounded"></div>
            <div className="h-16 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-slate-200/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900">Micro-Sections</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {showAddForm && filterOptions && (
        <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Section Name
              </label>
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g., Zero Quantity Items, Boisson Products"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Filters (Optional)
              </label>
              <div className="space-y-2">
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All Suppliers</option>
                  {filterOptions.suppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </select>
                
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All Categories</option>
                  {filterOptions.categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                
                <select
                  value={filterBrand}
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All Brands</option>
                  {filterOptions.brands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
                
                <select
                  value={filterUnit}
                  onChange={(e) => setFilterUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All Units</option>
                  {filterOptions.units.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
                
                <select
                  value={filterQtyType}
                  onChange={(e) => setFilterQtyType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All Quantities</option>
                  <option value="zero">Zero Qty (0)</option>
                  <option value="non_zero">Non-Zero Qty</option>
                  <option value="custom">Custom Range</option>
                </select>
                
                {filterQtyType === 'custom' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={filterQtyMin}
                      onChange={(e) => setFilterQtyMin(e.target.value)}
                      placeholder="Min qty"
                      className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={filterQtyMax}
                      onChange={(e) => setFilterQtyMax(e.target.value)}
                      placeholder="Max qty"
                      className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                )}
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filterUncountedOnly}
                    onChange={(e) => setFilterUncountedOnly(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">Show uncounted only</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSection}
                disabled={!newSectionName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View All option */}
      <button
        onClick={() => onSelectSection(null)}
        className={`w-full mb-2 p-4 rounded-xl border transition-all flex items-center justify-between ${
          selectedSectionId === null
            ? 'bg-blue-50 border-blue-500'
            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
            <Package className="w-5 h-5 text-slate-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-slate-900">All Products</p>
            <p className="text-sm text-slate-500">View all items</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400" />
      </button>

      {/* Micro-sections list */}
      <div className="space-y-2">
        {sections.map(section => {
          const progress = section.products_count > 0 
            ? (section.counted_count / section.products_count) * 100 
            : 0;

          return (
            <div
              key={section.id}
              className={`p-4 rounded-xl border transition-all ${
                selectedSectionId === section.id
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <button
                  onClick={() => handleSelectSection(section)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {section.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{section.name}</p>
                      <p className="text-xs text-slate-500">
                        <Filter className="w-3 h-3 inline mr-1" />
                        {getFilterSummary(section)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-slate-500 ml-13">
                    <span className="flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      {section.products_count} products
                    </span>
                    {section.assigned_users.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {section.assigned_users.map(u => u.user_name).join(', ')}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => handleDeleteSection(section.id)}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {section.products_count > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Progress</span>
                    <span>{section.counted_count} / {section.products_count}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sections.length === 0 && !showAddForm && (
        <div className="text-center py-8 text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No micro-sections yet</p>
          <p className="text-sm">Create filter-based sections to organize counting work</p>
        </div>
      )}
    </div>
  );
}
