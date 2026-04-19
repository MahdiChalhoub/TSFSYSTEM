import { ShieldCheck } from 'lucide-react';
import type { MenuItem } from './types';

export const hr: MenuItem = {
    title: 'HR & Teams',
    icon: ShieldCheck,
    module: 'hr',
    children: [
        { title: 'HR Overview', path: '/hr/overview' },
        { title: 'Employee Manager', path: '/hr/employees' },
        { title: 'Departments', path: '/hr/departments' },
        { title: 'Shifts', path: '/hr/shifts' },
        { title: 'Attendance', path: '/hr/attendance' },
        { title: 'Leave Requests', path: '/hr/leaves' },
        { title: 'Payroll Summary', path: '/hr/payroll' },
        { title: 'Pending Approvals', path: '/users/approvals' },
    ],
};
