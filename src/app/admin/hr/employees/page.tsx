/** HR Data Center - Employees */
import { prisma } from "@/lib/db";
import EmployeeManager from "./manager";
import { getRoles } from "@/app/actions/people";
import { Users, Briefcase, Fingerprint } from "lucide-react";
import { serializeDecimals } from "@/lib/utils/serialization";

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
    const employees = await prisma.employee.findMany({
        include: {
            homeSite: { select: { name: true } },
            linkedAccount: { select: { code: true } },
            user: { select: { id: true, email: true } }
        },
        orderBy: { lastName: 'asc' }
    });

    const sites = await prisma.site.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true }
    });

    const roles = await getRoles();

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
                            <div className="text-5xl font-black text-indigo-600 tracking-tighter mb-1">{employees.filter(e => e.user).length}</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">System Access</div>
                        </div>
                        <div className="text-center px-8">
                            <div className="text-5xl font-black text-emerald-600 tracking-tighter mb-1">{sites.length}</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Branches</div>
                        </div>
                    </div>
                </div>

                <EmployeeManager
                    employees={serializeDecimals(employees)}
                    sites={serializeDecimals(sites)}
                    roles={serializeDecimals(roles)}
                />
            </div>
        </div>
    );
}
