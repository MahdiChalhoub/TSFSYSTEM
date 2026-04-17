/** Workspace — Task Management Dashboard */
import { erpFetch } from "@/lib/erp-api";
import TasksClient from "./client";

export const dynamic = 'force-dynamic';

async function getTasks() {
    try { return await erpFetch('workspace/tasks/?root_only=true') } catch { return [] }
}

async function getCategories() {
    try { return await erpFetch('workspace/task-categories/') } catch { return [] }
}

async function getDashboard() {
    try { return await erpFetch('workspace/tasks/dashboard/') } catch {
        return { total_assigned: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0, assigned_by_me: 0 };
    }
}

async function getUsers() {
    try { return await erpFetch('users/') } catch { return [] }
}

export default async function TasksPage() {
    const [tasks, categories, dashboard, users] = await Promise.all([
        getTasks(), getCategories(), getDashboard(), getUsers(),
    ]);
    const arr = Array.isArray(tasks) ? tasks : (tasks?.results ?? []);

    return (
        <TasksClient
            tasks={arr}
            categories={Array.isArray(categories) ? categories : []}
            users={Array.isArray(users) ? users : []}
            dashboard={dashboard}
        />
    );
}
