/** HR Data Center - Employees */
import { erpFetch } from '@/lib/erp-api';
import EmployeeManager from './manager';
import { Users, Briefcase, ShieldCheck, Fingerprint } from 'lucide-react';

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
 has_internal_pin: e.has_internal_pin,
 } : null,
 }));
 } catch { return []; }
}

async function getStandaloneUsers(employeeUserIds: string[]) {
 try {
 const users = await erpFetch('erp/users/');
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
 user: { id: u.id, email: u.email, has_official_pin: u.has_official_pin, has_internal_pin: u.has_internal_pin },
 isStandaloneUser: true,
 }));
 } catch { return []; }
}

async function getSites() {
 try { return await erpFetch('erp/sites/'); } catch { return []; }
}

async function getRoles() {
 try { return await erpFetch('roles/'); } catch { return []; }
}

export default async function EmployeesPage() {
 const [employees, sites, roles] = await Promise.all([getEmployees(), getSites(), getRoles()]);
 const employeeUserIds = employees.filter((e: Record<string, any>) => e.user).map((e: Record<string, any>) => e.user.id);
 const standaloneUsers = await getStandaloneUsers(employeeUserIds);
 const allPeople = [...employees, ...standaloneUsers];

 const activeStaff = allPeople.filter((e: Record<string, any>) => e.status !== 'Inactive').length;
 const withAccess = allPeople.filter((e: Record<string, any>) => e.user).length;
 const withPin = allPeople.filter((e: Record<string, any>) => e.user?.has_official_pin || e.user?.has_internal_pin).length;

 const kpis = [
 { label: 'Total Staff', value: allPeople.length, icon: Briefcase, color: 'var(--app-primary)' },
 { label: 'Active', value: activeStaff, icon: Users, color: 'var(--app-success)' },
 { label: 'System Access', value: withAccess, icon: ShieldCheck, color: 'var(--app-info)' },
 { label: 'PIN Configured', value: withPin, icon: Fingerprint, color: 'var(--app-warning)' },
 ];

 return (
 <div
 className="app-page min-h-screen p-5 md:p-6 space-y-5 max-w-[1600px] mx-auto bg-app-background"
 style={{ color: 'var(--app-foreground)' }}
 >
 {/* ── Header ────────────────────────────── */}
 <header className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 fade-in-up">
 <div className="flex items-center gap-4">
 <div
 className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
 style={{ background: 'var(--app-primary)', boxShadow: '0 8px 24px var(--app-primary-glow)' }}
 >
 <Users size={26} color="#fff" />
 </div>
 <div>
 <h1
 className="text-3xl font-black tracking-tight"
 style={{ color: 'var(--app-foreground)' }}
 >
 HR <span style={{ color: 'var(--app-primary)' }}>Command</span>
 </h1>
 <p className="text-sm mt-0.5 uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
 Resource Master & Professional Directory
 </p>
 </div>
 </div>
 </header>

 {/* ── KPI Row ───────────────────────────── */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-in-up" style={{ animationDelay: '60ms' }}>
 {kpis.map((kpi, i) => (
 <div key={i} className="app-kpi-card flex items-center gap-4">
 <div
 className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
 style={{ background: kpi.color + '22' }}
 >
 <kpi.icon size={20} style={{ color: kpi.color }} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
 {kpi.label}
 </p>
 <p className="text-2xl font-black tracking-tight" style={{ color: kpi.color }}>
 {kpi.value}
 </p>
 </div>
 </div>
 ))}
 </div>

 {/* ── Employee Manager ──────────────────── */}
 <EmployeeManager employees={allPeople} sites={sites} roles={roles} />
 </div>
 );
}