import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Database, ChevronLeft, ChevronRight, Users, LogOut, Menu, X, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Sessions' },
    { path: '/products', icon: Package, label: 'Products' },
    { path: '/adjustment-orders', icon: ClipboardCheck, label: 'Adjustments' },
    { path: '/users', icon: Users, label: 'Users' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all"
      >
        {mobileMenuOpen ? <X className="w-6 h-6 text-slate-700" /> : <Menu className="w-6 h-6 text-slate-700" />}
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        ${isCollapsed ? 'w-20' : 'w-64'}
        bg-white/80 backdrop-blur-sm border-r border-slate-200/50 shadow-lg transition-all duration-300
        fixed lg:static inset-y-0 left-0 z-40
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 flex flex-col h-full">
          {/* Header with Toggle Button */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} mb-8`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl">
                <Database className="w-6 h-6 text-white" />
              </div>
              {!isCollapsed && (
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Inventory
                </h1>
              )}
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`${isCollapsed ? 'absolute top-6 right-6' : ''} p-2 hover:bg-slate-100 text-slate-700 rounded-lg transition-all`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>

          <nav className="space-y-2 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5" />
                  {!isCollapsed && <span className="font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          {user && (
            <div className="pt-4 border-t border-slate-200">
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 text-slate-700`}>
                {user.google_user_data.picture ? (
                  <img
                    src={user.google_user_data.picture}
                    alt={user.google_user_data.name || user.email}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                    <Users className="w-4 h-4 text-slate-500" />
                  </div>
                )}
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {user.google_user_data.name || 'User'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                )}
              </div>
              <button
                onClick={logout}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} w-full px-4 py-3 text-slate-700 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all mt-2`}
                title={isCollapsed ? 'Sign out' : undefined}
              >
                <LogOut className="w-5 h-5" />
                {!isCollapsed && <span className="font-medium">Sign out</span>}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
