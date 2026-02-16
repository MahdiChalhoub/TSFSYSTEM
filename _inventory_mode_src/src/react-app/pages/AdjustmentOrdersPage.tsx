import { useState, useEffect } from 'react';
import { ClipboardCheck, Calendar, User, Package, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdjustmentOrder {
  id: number;
  session_id: number;
  created_by_user_id: string | null;
  created_by_user_name: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  created_at: string;
  updated_at: string;
  item_count?: number;
  session_location?: string;
  session_section?: string;
  session_date?: string;
}

export default function AdjustmentOrdersPage() {
  const [orders, setOrders] = useState<AdjustmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      
      // Get all sessions first
      const sessionsRes = await fetch('/api/inventory-sessions');
      const sessions = await sessionsRes.json();
      
      // Get adjustment orders for each session
      const allOrders: AdjustmentOrder[] = [];
      for (const session of sessions) {
        const ordersRes = await fetch(`/api/inventory-sessions/${session.id}/adjustment-orders`);
        const sessionOrders = await ordersRes.json();
        
        // Enrich orders with session data
        sessionOrders.forEach((order: AdjustmentOrder) => {
          allOrders.push({
            ...order,
            session_location: session.location,
            session_section: session.section,
            session_date: session.session_date
          });
        });
      }
      
      // Sort by created_at descending
      allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setOrders(allOrders);
    } catch (error) {
      console.error('Failed to load adjustment orders:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Pending
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  const pendingCount = orders.filter(o => o.status === 'PENDING').length;
  const inProgressCount = orders.filter(o => o.status === 'IN_PROGRESS').length;
  const completedCount = orders.filter(o => o.status === 'COMPLETED').length;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl shadow-lg">
              <ClipboardCheck className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Adjustment Orders
              </h1>
              <p className="text-slate-600 mt-1">
                Track and manage inventory adjustments
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-slate-200/50">
              <p className="text-slate-600 text-sm font-medium mb-1">Total Orders</p>
              <p className="text-3xl font-bold text-slate-900">{orders.length}</p>
            </div>
            <div className="bg-yellow-50/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-yellow-200/50">
              <p className="text-yellow-800 text-sm font-medium mb-1">Pending</p>
              <p className="text-3xl font-bold text-yellow-900">{pendingCount}</p>
            </div>
            <div className="bg-blue-50/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-200/50">
              <p className="text-blue-800 text-sm font-medium mb-1">In Progress</p>
              <p className="text-3xl font-bold text-blue-900">{inProgressCount}</p>
            </div>
            <div className="bg-green-50/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-200/50">
              <p className="text-green-800 text-sm font-medium mb-1">Completed</p>
              <p className="text-3xl font-bold text-green-900">{completedCount}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                  : 'bg-white/80 text-slate-700 hover:bg-white'
              }`}
            >
              All Orders
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                statusFilter === 'PENDING'
                  ? 'bg-gradient-to-r from-yellow-600 to-yellow-700 text-white shadow-lg'
                  : 'bg-white/80 text-slate-700 hover:bg-white'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('IN_PROGRESS')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                statusFilter === 'IN_PROGRESS'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                  : 'bg-white/80 text-slate-700 hover:bg-white'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                statusFilter === 'COMPLETED'
                  ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg'
                  : 'bg-white/80 text-slate-700 hover:bg-white'
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 text-center shadow-lg border border-slate-200/50">
            <ClipboardCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 text-lg">
              {statusFilter === 'all' 
                ? 'No adjustment orders yet'
                : `No ${statusFilter.toLowerCase().replace('_', ' ')} orders`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Link
                key={order.id}
                to={`/adjustment-orders/${order.id}`}
                className="block bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-slate-200/50 hover:shadow-xl hover:border-purple-300 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-slate-900">
                        Order #{order.id}
                      </h3>
                      {getStatusBadge(order.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>
                          {new Date(order.session_date || order.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-slate-600">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span>{order.item_count || 0} items</span>
                      </div>

                      {order.created_by_user_name && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="truncate">{order.created_by_user_name}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="font-medium">Session:</span>
                        <span className="truncate">
                          {order.session_location} - {order.session_section}
                        </span>
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-purple-600 transition-colors flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
