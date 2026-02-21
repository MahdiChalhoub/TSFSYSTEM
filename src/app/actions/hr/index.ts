'use server'

// HR Module — Barrel Export
// Re-exports all HR actions from individual files for consolidated imports
// Pages import from '@/app/actions/hr' which resolves to this file

export { getEmployees, getEmployee } from './employees'
export { getDepartments, getDepartment, getDepartmentTree, createDepartment, updateDepartment, deleteDepartment } from './departments'
export { getShifts, getShift, createShift, updateShift, deleteShift } from './shifts'
export { getAttendanceRecords, getAttendanceRecord, createAttendance, checkIn, checkOut, deleteAttendanceRecord } from './attendance'
export { getLeaves, getLeave, createLeave, approveLeave, rejectLeave, deleteLeave } from './leaves'
