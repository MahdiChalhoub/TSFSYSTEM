import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import SessionCard from '../components/SessionCard';
import NewSessionModal from '../components/NewSessionModal';
import SyncPanel from '../components/SyncPanel';

interface SessionAssignment {
  user_name: string;
}

interface InventorySession {
  id: number;
  location: string;
  section: string;
  person1_name: string;
  person2_name: string;
  session_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  assigned_users?: SessionAssignment[];
  products_count?: number;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const navigate = useNavigate();

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/inventory-sessions');
      if (response.ok) {
        const sessionsData = await response.json();
        // Fetch details for each session (assignments and product count)
        const sessionsWithDetails = await Promise.all(
          sessionsData.map(async (session: InventorySession) => {
            try {
              const detailsRes = await fetch(`/api/inventory-sessions/${session.id}`);
              if (detailsRes.ok) {
                const details = await detailsRes.json();
                return {
                  ...session,
                  assigned_users: details.assigned_users,
                  products_count: details.products_count
                };
              }
            } catch (e) {
              console.error('Failed to fetch session details:', e);
            }
            return session;
          })
        );
        setSessions(sessionsWithDetails);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'WAITING_VERIFICATION':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'VERIFIED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'ADJUSTED':
        return <CheckCircle className="w-5 h-5 text-purple-500" />;
      default:
        return <Package className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-700';
      case 'WAITING_VERIFICATION':
        return 'bg-yellow-100 text-yellow-700';
      case 'VERIFIED':
        return 'bg-green-100 text-green-700';
      case 'ADJUSTED':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const inProgressCount = sessions.filter(s => s.status === 'IN_PROGRESS').length;
  const pendingCount = sessions.filter(s => s.status === 'WAITING_VERIFICATION').length;
  const completedCount = sessions.filter(s => s.status === 'VERIFIED' || s.status === 'ADJUSTED').length;

  const handleModalClose = () => {
    setShowNewModal(false);
    fetchSessions(); // Refresh sessions after modal closes
  };

  const handleDeleteSession = async (sessionId: number) => {
    const adminCode = prompt('Enter admin code to delete this session:');
    
    if (!adminCode) {
      return; // User cancelled
    }

    try {
      const response = await fetch(`/api/inventory-sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ admin_code: adminCode }),
      });
      
      if (response.ok) {
        // Refresh the sessions list
        fetchSessions();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete session');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Error deleting session');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-2">
                Inventory Sessions
              </h1>
              <p className="text-sm sm:text-base text-slate-600">Manage stock counting and verification</p>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              <Plus className="w-5 h-5" />
              New Session
            </button>
          </div>
        </div>

        {/* Sync Panel */}
        <div className="mb-8">
          <SyncPanel />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border border-slate-200/50">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg sm:rounded-xl">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">In Progress</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900">{inProgressCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border border-slate-200/50">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg sm:rounded-xl">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">Pending Verification</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900">{pendingCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border border-slate-200/50">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-green-100 rounded-lg sm:rounded-xl">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-600">Completed</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900">{completedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 shadow-lg border border-slate-200/50 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No inventory sessions yet</h3>
            <p className="text-slate-600 mb-6">
              Create your first inventory session to start counting stock
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg"
            >
              <Plus className="w-5 h-5" />
              New Session
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={{
                  id: session.id.toString(),
                  location: session.location,
                  section: session.section,
                  person1: session.person1_name,
                  person2: session.person2_name,
                  date: session.session_date,
                  status: session.status,
                  itemsCount: session.products_count || 0,
                  completedItems: 0,
                  assignedUsers: session.assigned_users
                }}
                statusIcon={getStatusIcon(session.status)}
                statusColor={getStatusColor(session.status)}
                onOpen={() => navigate(`/session/${session.id}/count`)}
                onVerify={() => navigate(`/session/${session.id}/verify`)}
                onDelete={() => handleDeleteSession(session.id)}
              />
            ))}
          </div>
        )}
      {showNewModal && <NewSessionModal onClose={handleModalClose} />}
    </div>
  );
}
