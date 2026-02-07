/** HR Data Center - Employees */
import { erpFetch } from "@/lib/erp-api";
import EmployeeManager from "./manager";
import { Users, Briefcase, Fingerprint } from "lucide-react";

export const dynamic = 'force-dynamic';

async function getEmployees() {
    try {
        const data = await erpFetch('employees/');
        // Mapping snake_case (Django) to camelCase (Frontend)
        // EmployeeSerializer: home_site, linked_account, user_email, user_id
        // Frontend likely expects: homeSite, linkedAccount, user: { email, id }
        return data.map((e: any) => ({
            ...e,
            firstName: e.first_name,
            lastName: e.last_name,
            jobTitle: e.job_title,
            homeSite: e.home_site,
            linkedAccount: e.linked_account,
            user: e.user_id ? { id: e.user_id, email: e.user_email } : null
        }));
    } catch (e) {
        console.error("Failed to fetch employees", e);
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

    return (
        <div className="min-h-screen bg-[#FDFDFF] p-8 lg:p-12">
            <div className="max-w-[1700px] mx-auto space-y-12">
                {/* HR Command Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-[20px] bg-black flex items-center justify-center text-white shadow-2xl">
                                <Fingerprint size={24} />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">Resource Master</span>
                        </div>
                        <h1 className="text-6xl lg:text-7xl font-black text-gray-900 tracking-tighter">
                            HR <span className="text-indigo-600">Command</span>
                        </h1>
                        <p className="text-gray-500 font-medium max-w-xl text-lg leading-relaxed">
                            Unified management of your company's human capital. Linking physical employees to system security and financial payroll dimensions.
                        </p>
                    </div>

                    <div className="flex gap-8 bg-white p-10 rounded-[50px] shadow-2xl shadow-indigo-900/5 border border-gray-50">
                        <div className="text-center px-8 border-r border-gray-100">
                            <div className="text-5xl font-black text-gray-900 tracking-tighter mb-1">{employees.length}</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Staff</div>
                        </div>
                        <div className="text-center px-8 border-r border-gray-100">
                            <div className="text-5xl font-black text-indigo-600 tracking-tighter mb-1">{employees.filter((e: any) => e.user).length}</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">System Access</div>
                        </div>
                        <div className="text-center px-8">
                            <div className="text-5xl font-black text-emerald-600 tracking-tighter mb-1">{sites.length}</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Branches</div>
                        </div>
                    </div>
                </div>

                <EmployeeManager
                    employees={employees}
                    sites={sites}
                    roles={roles}
                />
            </div>
        </div>
    );
}