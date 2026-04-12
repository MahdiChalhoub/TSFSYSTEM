/** HR Data Center - Employees */
import { erpFetch } from "@/lib/erp-api";
import EmployeeManager from "./manager";
import { Users, Briefcase, Fingerprint } from "lucide-react";

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
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* HR Command Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[20px] bg-app-foreground flex items-center justify-center text-white shadow-2xl">
                            <Fingerprint size={24} />
                        </div>
                        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.4em]">Resource Master</span>
                    </div>
                    <h1 className="text-6xl lg:text-7xl font-black text-app-foreground tracking-tighter">
                        HR <span className="text-indigo-600">Command</span>
                    </h1>
                    <p className="text-app-muted-foreground font-medium max-w-xl text-lg leading-relaxed">
                        Unified management of your company's human capital. Linking physical employees to system security and financial payroll dimensions.
                    </p>
                </div>

                <div className="flex gap-8 bg-app-surface p-10 rounded-[50px] shadow-2xl shadow-indigo-900/5 border border-gray-50">
                    <div className="text-center px-8 border-r border-app-border">
                        <div className="text-5xl font-black text-app-foreground tracking-tighter mb-1">{allPeople.length}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Total Staff</div>
                    </div>
                    <div className="text-center px-8 border-r border-app-border">
                        <div className="text-5xl font-black text-indigo-600 tracking-tighter mb-1">{allPeople.filter((e: Record<string, any>) => e.user).length}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">System Access</div>
                    </div>
                    <div className="text-center px-8">
                        <div className="text-5xl font-black text-emerald-600 tracking-tighter mb-1">{sites.length}</div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Active Branches</div>
                    </div>
                </div>
            </div>

            <EmployeeManager
                employees={allPeople}
                sites={sites}
                roles={roles}
            />
        </div>
    );
}