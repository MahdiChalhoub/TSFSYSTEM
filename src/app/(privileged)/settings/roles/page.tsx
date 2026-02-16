import React from 'react';
import { RoleManager } from './RoleManager';
import { getRoles, getPermissions } from '@/app/actions/roles';
import { Shield } from 'lucide-react';

export default async function RolesPage() {
    const roles = await getRoles();
    const permissions = await getPermissions();

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-xl">
                            <Shield className="text-emerald-600" size={28} />
                        </div>
                        Access Control
                    </h1>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        Secure your organization with granular roles and permissions
                    </p>
                </div>
            </div>

            <RoleManager initialRoles={roles} allPermissions={permissions} />
        </div>
    );
}
