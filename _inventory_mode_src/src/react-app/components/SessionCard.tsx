import { ChevronRight, Calendar, Users, Package, CheckSquare, Trash2 } from 'lucide-react';

interface SessionCardProps {
  session: {
    id: string;
    location: string;
    section: string;
    person1: string;
    person2: string;
    date: string;
    status: string;
    itemsCount: number;
    completedItems: number;
    assignedUsers?: { user_name: string }[];
  };
  statusIcon: React.ReactNode;
  statusColor: string;
  onOpen: () => void;
  onVerify?: () => void;
  onDelete: () => void;
}

export default function SessionCard({ session, statusIcon, statusColor, onOpen, onVerify, onDelete }: SessionCardProps) {
  const progress = session.itemsCount > 0 ? (session.completedItems / session.itemsCount) * 100 : 0;

  // Display assigned users or fall back to person1/person2
  const displayUsers = () => {
    if (session.assignedUsers && session.assignedUsers.length > 0) {
      if (session.assignedUsers.length === 1) {
        return session.assignedUsers[0].user_name;
      } else if (session.assignedUsers.length === 2) {
        return `${session.assignedUsers[0].user_name} & ${session.assignedUsers[1].user_name}`;
      } else {
        return `${session.assignedUsers[0].user_name} + ${session.assignedUsers.length - 1} others`;
      }
    }
    // Fallback to person1/person2
    if (session.person1 === session.person2) {
      return session.person1;
    }
    return `${session.person1} & ${session.person2}`;
  };

  const handleVerifyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const adminCode = prompt('Enter admin code to access verification:');
    if (adminCode && onVerify) {
      onVerify();
    }
  };

  return (
    <div 
      className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-slate-200/50 hover:shadow-xl transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xl font-bold text-slate-900">{session.location}</h3>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-sm font-medium">
              {session.section}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(session.date).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {displayUsers()}
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              {session.itemsCount} products
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${statusColor}`}>
              {statusIcon}
              {session.status.replace(/_/g, ' ')}
            </div>
            {session.itemsCount > 0 && (
              <div className="text-sm text-slate-600">
                {session.completedItems} / {session.itemsCount} counted
              </div>
            )}
          </div>

          {session.status === 'IN_PROGRESS' && session.itemsCount > 0 && (
            <div className="mt-4">
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {onVerify && (
            <button
              onClick={handleVerifyClick}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-md text-sm font-medium"
            >
              <CheckSquare className="w-4 h-4" />
              Verify
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this session? This will permanently delete all counting data.')) {
                  onDelete();
                }
              }}
              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
            >
              Count
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
