import React from 'react';
import { RoleManager } from './RoleManager';
import { getRoles, getPermissions } from '@/app/actions/roles';
import { Shield } from 'lucide-react';

export default async function RolesPage() {
 let roles: any = [], permissions: any = [];
 try { roles = await getRoles(); } catch { }
 try { permissions = await getPermissions(); } catch { }

 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header>
 <h1 className="page-header-title uppercase tracking-tighter flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
 <Shield className="text-app-text" size={28} />
 </div>
 Access <span className="text-emerald-600">Control</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">
 Granular Roles & Permission Architecture
 </p>
 </header>

 <RoleManager initialRoles={roles} allPermissions={permissions} />
 </div>
 );
}
