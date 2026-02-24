/** HR Data Center - Employees */
import { erpFetch } from "@/lib/erp-api";
import EmployeeManager from "./manager";
import { Users, Briefcase, Fingerprint, ShieldCheck } from "lucide-react";
export const dynamic = 'force-dynamic';
async function getEmployees() {
    try {
        const data = await erpFetch('employees/');
        return data.map((e: Record<string, any>) => ({
            ...e,
            firstName: e.first_name,
            lastName: e.last_name,
            jobTitle: e.job_title,
            homeSite: e.home_site,
            linkedAccount: e.linked_account,
            dividendsAccount: e.dividends_account,
            employeeType: e.employee_type,
            employeeId: e.employee_id || e.employeeId || 'N/A',
            user: e.user_id ? {
                id: e.user_id,
                email: e.user_email,
                has_official_pin: e.has_official_pin,
                has_internal_pin: e.has_internal_pin
            } : null
        }));
    } catch (e) {
        console.error("Failed to fetch employees", e);
        return [];
    }
}
async function getStandaloneUsers(employeeUserIds: string[]) {
    try {
        const users = await erpFetch('users/');
        // Filter users that don't have an Employee record
        return users
            .filter((u: Record<string, any>) => !employeeUserIds.includes(u.id))
            .map((u: Record<string, any>) => ({
                id: `user-${u.id}`,
                firstName: u.first_name || u.username,
                lastName: u.last_name || '',
                jobTitle: u.is_superuser ? 'Superadmin' : 'System User',
                employeeId: u.username,
                status: u.is_active ? 'Active' : 'Inactive',
                homeSite: null,
                linkedAccount: null,
                dividendsAccount: null,
                employeeType: null,
                user: {
                    id: u.id,
                    email: u.email,
                    has_official_pin: u.has_official_pin,
                    has_internal_pin: u.has_internal_pin
                },
                isStandaloneUser: true
            }));
    } catch (e) {
        console.error("Failed to fetch users", e);
        return [];
    }
}
async function getSites() {
    try {
        return await erpFetch('sites/');
    } catch (e) {
        return [];
    }
}
async function getRoles() {
    try {
        const data = await erpFetch('roles/');
        // Assuming RoleSerializer returns fields as is.
        // Frontend getRoles action implies it returns roles with _count.users
        // Django RoleSerializer does NOT have _count by default unless I add it.
        // I will add _count mapping if data doesn't have it, or assume 0 for now.
        // Or better: update RoleSerializer later.
        return data;
    } catch (e) {
        return [];
    }
}
export default async function EmployeesPage() {
    const [employees, sites, roles] = await Promise.all([
        getEmployees(),
        getSites(),
        getRoles()
    ]);
    // Fetch users that don't have Employee records (e.g. superusers)
    const employeeUserIds = employees.filter((e: Record<string, any>) => e.user).map((e: Record<string, any>) => e.user.id);
    const standaloneUsers = await getStandaloneUsers(employeeUserIds);
    const allPeople = [...employees, ...standaloneUsers];
    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 text-white">
                            <Users size={28} />
                        </div>
                        HR <span className="text-emerald-600">Command</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Resource Master & Professional Directory</p>
                </div>
                {/* Action Pulse */}
                <div className="flex gap-4">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-5 min-w-[200px]">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center">
                            <Briefcase size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 leading-none mb-1">Total Staff</p>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tighter">{allPeople.length}</h2>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-100 flex items-center gap-5 min-w-[200px]">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1 leading-none mb-1">System Access</p>
                            <h2 className="text-2xl font-black text-emerald-600 tracking-tighter">{allPeople.filter((e: Record<string, any>) => e.user).length}</h2>
                        </div>
                    </div>
                </div>
            </header>
            <EmployeeManager
                employees={allPeople}
                sites={sites}
                roles={roles}
            />
        </div>
    );
}