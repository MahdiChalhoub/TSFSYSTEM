'use server';

import { erpFetch } from '@/lib/erp-api';

// =============================================================================
// TASK CATEGORIES
// =============================================================================

export async function getTaskCategories() {
    return erpFetch('/workspace/task-categories/');
}

export async function createTaskCategory(data: Record<string, unknown>) {
    return erpFetch('/workspace/task-categories/', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTaskCategory(id: number, data: Record<string, unknown>) {
    return erpFetch(`/workspace/task-categories/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteTaskCategory(id: number) {
    return erpFetch(`/workspace/task-categories/${id}/`, { method: 'DELETE' });
}

// =============================================================================
// TASK TEMPLATES
// =============================================================================

export async function getTaskTemplates() {
    return erpFetch('/workspace/templates/');
}

export async function createTaskTemplate(data: Record<string, unknown>) {
    return erpFetch('/workspace/templates/', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTaskTemplate(id: number, data: Record<string, unknown>) {
    return erpFetch(`/workspace/templates/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteTaskTemplate(id: number) {
    return erpFetch(`/workspace/templates/${id}/`, { method: 'DELETE' });
}

// =============================================================================
// AUTO-TASK RULES
// =============================================================================

export async function getAutoTaskRules() {
    return erpFetch('/workspace/auto-rules/');
}

export async function createAutoTaskRule(data: Record<string, unknown>) {
    return erpFetch('/workspace/auto-rules/', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAutoTaskRule(id: number, data: Record<string, unknown>) {
    return erpFetch(`/workspace/auto-rules/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteAutoTaskRule(id: number) {
    return erpFetch(`/workspace/auto-rules/${id}/`, { method: 'DELETE' });
}

// =============================================================================
// TASKS
// =============================================================================

export async function getTasks(params?: string) {
    return erpFetch(`/workspace/tasks/${params ? '?' + params : ''}`);
}

export async function getMyTasks() {
    return erpFetch('/workspace/tasks/?mine=true');
}

export async function getTasksByStatus(status: string) {
    return erpFetch(`/workspace/tasks/?status=${status}`);
}

export async function getTask(id: number) {
    return erpFetch(`/workspace/tasks/${id}/`);
}

export async function createTask(data: Record<string, unknown>) {
    return erpFetch('/workspace/tasks/', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTask(id: number, data: Record<string, unknown>) {
    return erpFetch(`/workspace/tasks/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteTask(id: number) {
    return erpFetch(`/workspace/tasks/${id}/`, { method: 'DELETE' });
}

export async function startTask(id: number) {
    return erpFetch(`/workspace/tasks/${id}/start/`, { method: 'POST' });
}

export async function completeTask(id: number) {
    return erpFetch(`/workspace/tasks/${id}/complete/`, { method: 'POST' });
}

export async function cancelTask(id: number) {
    return erpFetch(`/workspace/tasks/${id}/cancel/`, { method: 'POST' });
}

export async function addTaskComment(taskId: number, content: string, isResponse = false) {
    return erpFetch(`/workspace/tasks/${taskId}/add_comment/`, {
        method: 'POST',
        body: JSON.stringify({ content, is_response: isResponse }),
    });
}

export async function getTaskDashboard() {
    return erpFetch('/workspace/tasks/dashboard/');
}

// =============================================================================
// EMPLOYEE REQUESTS
// =============================================================================

export async function getEmployeeRequests() {
    return erpFetch('/workspace/requests/');
}

export async function createEmployeeRequest(data: Record<string, unknown>) {
    return erpFetch('/workspace/requests/', { method: 'POST', body: JSON.stringify(data) });
}

export async function approveRequest(id: number, createTask = false) {
    return erpFetch(`/workspace/requests/${id}/approve/`, {
        method: 'POST',
        body: JSON.stringify({ create_task: createTask }),
    });
}

export async function rejectRequest(id: number) {
    return erpFetch(`/workspace/requests/${id}/reject/`, { method: 'POST' });
}

// =============================================================================
// CHECKLISTS
// =============================================================================

export async function getChecklistTemplates() {
    return erpFetch('/workspace/checklist-templates/');
}

export async function createChecklistTemplate(data: Record<string, unknown>) {
    return erpFetch('/workspace/checklist-templates/', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateChecklistTemplate(id: number, data: Record<string, unknown>) {
    return erpFetch(`/workspace/checklist-templates/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteChecklistTemplate(id: number) {
    return erpFetch(`/workspace/checklist-templates/${id}/`, { method: 'DELETE' });
}

export async function addChecklistTemplateItem(templateId: number, data: Record<string, unknown>) {
    return erpFetch(`/workspace/checklist-templates/${templateId}/add_item/`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function getChecklists(params?: string) {
    return erpFetch(`/workspace/checklists/${params ? '?' + params : ''}`);
}

export async function getMyChecklists() {
    return erpFetch('/workspace/checklists/?mine=true');
}

export async function createChecklist(data: Record<string, unknown>) {
    return erpFetch('/workspace/checklists/', { method: 'POST', body: JSON.stringify(data) });
}

export async function checkChecklistItem(checklistId: number, itemId: number, isChecked: boolean, notes?: string) {
    return erpFetch(`/workspace/checklists/${checklistId}/check_item/`, {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId, is_checked: isChecked, notes }),
    });
}

// =============================================================================
// QUESTIONNAIRES & EVALUATIONS
// =============================================================================

export async function getQuestionnaires() {
    return erpFetch('/workspace/questionnaires/');
}

export async function createQuestionnaire(data: Record<string, unknown>) {
    return erpFetch('/workspace/questionnaires/', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateQuestionnaire(id: number, data: Record<string, unknown>) {
    return erpFetch(`/workspace/questionnaires/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function addQuestion(questionnaireId: number, data: Record<string, unknown>) {
    return erpFetch(`/workspace/questionnaires/${questionnaireId}/add_question/`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function getEvaluations(params?: string) {
    return erpFetch(`/workspace/evaluations/${params ? '?' + params : ''}`);
}

export async function createEvaluation(data: Record<string, unknown>) {
    return erpFetch('/workspace/evaluations/', { method: 'POST', body: JSON.stringify(data) });
}

export async function submitEvaluationAnswers(evaluationId: number, answers: Record<string, unknown>[]) {
    return erpFetch(`/workspace/evaluations/${evaluationId}/submit_answers/`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
    });
}

// =============================================================================
// KPI & PERFORMANCE
// =============================================================================

export async function getKPIConfig() {
    return erpFetch('/workspace/kpi-config/');
}

export async function updateKPIConfig(id: number, data: Record<string, unknown>) {
    return erpFetch(`/workspace/kpi-config/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function createKPIConfig(data: Record<string, unknown>) {
    return erpFetch('/workspace/kpi-config/', { method: 'POST', body: JSON.stringify(data) });
}

export async function getEmployeeScores(params?: string) {
    return erpFetch(`/workspace/scores/${params ? '?' + params : ''}`);
}

export async function getLeaderboard(period?: string) {
    return erpFetch(`/workspace/scores/leaderboard/${period ? '?period=' + period : ''}`);
}

export async function getMyPerformance() {
    return erpFetch('/workspace/scores/my_performance/');
}
