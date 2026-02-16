import { useState, useEffect } from 'react';
import { X, MapPin, Loader2, Users, Package, Check } from 'lucide-react';

interface NewSessionModalProps {
  onClose: () => void;
}

interface Location {
  id: number;
  external_location_id: string;
  name: string;
  landmark: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  mobile: string | null;
  email: string | null;
}

interface User {
  id: number;
  external_user_id: string;
  email: string;
  name: string | null;
  picture_url: string | null;
}

interface Supplier {
  id: number;
  external_supplier_id: string;
  name: string;
}

interface Category {
  category: string;
}

export default function NewSessionModal({ onClose }: NewSessionModalProps) {
  const [formData, setFormData] = useState({
    location_id: '',
    category: '', // empty means all categories
    supplier_id: '', // empty means all products
    qty_filter: '', // 'zero', 'non_zero', 'custom', or empty for all
    qty_min: '',
    qty_max: '',
  });
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [locationsRes, usersRes, suppliersRes, categoriesRes] = await Promise.all([
          fetch('/api/locations'),
          fetch('/api/users'),
          fetch('/api/suppliers'),
          fetch('/api/categories')
        ]);
        
        if (locationsRes.ok && usersRes.ok && suppliersRes.ok && categoriesRes.ok) {
          setLocations(await locationsRes.json());
          setUsers(await usersRes.json());
          setSuppliers(await suppliersRes.json());
          setCategories(await categoriesRes.json());
        } else {
          setError('Failed to load data. Please try again.');
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch product count when filters change
  useEffect(() => {
    const fetchProductCount = async () => {
      try {
        const params = new URLSearchParams();
        if (formData.supplier_id) params.append('supplier_id', formData.supplier_id);
        if (formData.category) params.append('category', formData.category);
        if (formData.qty_filter) {
          params.append('qty_filter', formData.qty_filter);
          if (formData.qty_filter === 'custom') {
            if (formData.qty_min) params.append('qty_min', formData.qty_min);
            if (formData.qty_max) params.append('qty_max', formData.qty_max);
          }
        }
        
        const url = `/api/products/count${params.toString() ? '?' + params.toString() : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setProductCount(data.total);
        }
      } catch (error) {
        console.error('Failed to fetch product count:', error);
      }
    };

    fetchProductCount();
  }, [formData.supplier_id, formData.category, formData.qty_filter, formData.qty_min, formData.qty_max]);

  const toggleUser = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const selectedLocation = locations.find(loc => loc.id.toString() === formData.location_id);

    if (!selectedLocation) {
      setError('Please select a location');
      setSubmitting(false);
      return;
    }

    if (selectedUsers.length === 0) {
      setError('Please assign at least one person');
      setSubmitting(false);
      return;
    }

    // Build assigned_users array
    const assigned_users = selectedUsers.map(userId => {
      const user = users.find(u => u.id === userId);
      return {
        user_id: userId,
        user_name: user?.name || user?.email || 'Unknown'
      };
    });

    try {
      const response = await fetch('/api/inventory-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: selectedLocation.name,
          section: formData.category || 'All Categories',
          assigned_users,
          session_date: new Date().toISOString().split('T')[0],
          supplier_id: formData.supplier_id || null,
          category: formData.category || null,
          qty_filter: formData.qty_filter || null,
          qty_min: formData.qty_filter === 'custom' && formData.qty_min ? parseInt(formData.qty_min) : null,
          qty_max: formData.qty_filter === 'custom' && formData.qty_max ? parseInt(formData.qty_max) : null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Session created with', data.products_added, 'products');
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create session');
      }
    } catch (error) {
      console.error('Failed to create session:', error);
      setError('Failed to create session. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLocation = locations.find(loc => loc.id.toString() === formData.location_id);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-2xl font-bold text-slate-900">New Inventory Session</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Location
            </label>
            {loading ? (
              <div className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500">
                Loading locations...
              </div>
            ) : locations.length === 0 ? (
              <div className="w-full px-4 py-3 border border-yellow-300 rounded-lg bg-yellow-50 text-yellow-800 text-sm flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>No locations available. Please sync locations first.</span>
              </div>
            ) : (
              <select
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                required
              >
                <option value="">Select a location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.city && ` - ${location.city}`}
                  </option>
                ))}
              </select>
            )}
            {selectedLocation && (
              <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-700">{selectedLocation.name}</p>
                    {selectedLocation.landmark && (
                      <p className="text-xs mt-0.5">{selectedLocation.landmark}</p>
                    )}
                    <p className="text-xs mt-0.5">
                      {[selectedLocation.city, selectedLocation.state, selectedLocation.country]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Category
            </label>
            {loading ? (
              <div className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500">
                Loading categories...
              </div>
            ) : (
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-slate-500">Filter products by category for this session</p>
          </div>

          {/* Supplier Filter (for products) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Supplier Filter
            </label>
            {loading ? (
              <div className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500">
                Loading suppliers...
              </div>
            ) : (
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quantity Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Quantity Filter
            </label>
            <select
              value={formData.qty_filter}
              onChange={(e) => setFormData({ ...formData, qty_filter: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">All Quantities</option>
              <option value="zero">Only Zero Quantity (= 0)</option>
              <option value="non_zero">Only Non-Zero Quantity (&gt; 0)</option>
              <option value="custom">Custom Range</option>
            </select>
            
            {formData.qty_filter === 'custom' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Min Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.qty_min}
                    onChange={(e) => setFormData({ ...formData, qty_min: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Max Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.qty_max}
                    onChange={(e) => setFormData({ ...formData, qty_max: e.target.value })}
                    placeholder="No limit"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">Filter products by their current system quantity</p>
          </div>

          {/* Product Count Display */}
          {productCount !== null && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Products to count</p>
                  <p className="text-2xl font-bold text-blue-700">{productCount.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Assigned Users (Multi-select) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Assign People ({selectedUsers.length} selected)
                </div>
                <button
                  type="button"
                  onClick={selectAllUsers}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {selectedUsers.length === users.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </label>
            {loading ? (
              <div className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500">
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="w-full px-4 py-3 border border-yellow-300 rounded-lg bg-yellow-50 text-yellow-800 text-sm">
                No users available. Team members must sign in first.
              </div>
            ) : (
              <div className="border border-slate-300 rounded-lg divide-y divide-slate-200 max-h-48 overflow-y-auto">
                {users.map((user) => {
                  const isSelected = selectedUsers.includes(user.id);
                  return (
                    <label
                      key={user.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-600' 
                          : 'border-slate-300'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleUser(user.id)}
                        className="sr-only"
                      />
                      {user.picture_url && (
                        <img 
                          src={user.picture_url} 
                          alt={user.name || user.email}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {user.name || user.email}
                        </p>
                        {user.name && (
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Select 1, 2, or all people to assign to this inventory session
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || submitting || locations.length === 0 || users.length === 0 || selectedUsers.length === 0}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Session'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
