import {
    ClipboardList,
    ListChecks,
    Trophy,
    Zap,
    Settings,
    Users,
    Crown,
} from 'lucide-react';
import type { MenuItem } from './types';

export const workspaceInProgress: MenuItem = {
    title: 'Workspace',
    icon: ClipboardList,
    module: 'workspace',
    stage: 'in-progress',
    children: [
        { title: 'TaskBoard', path: '/workspace/tasks', icon: ClipboardList },
        { title: 'Automations', path: '/workspace/auto-task-rules', icon: Zap },
        { title: 'Teams', path: '/workspace/user-groups', icon: Users },
        { title: 'Team Structure', path: '/workspace/leader-tree', icon: Crown },
    ],
};

export const workspace: MenuItem = {
    title: 'Workspace',
    icon: ClipboardList,
    module: 'workspace',
    children: [
        { title: 'Checklists', path: '/workspace/checklists', icon: ListChecks },
        { title: 'Checklist Templates', path: '/workspace/checklist-templates' },
        { title: 'Performance', path: '/workspace/performance', icon: Trophy },
        { title: 'Evaluations', path: '/workspace/evaluations' },
        { title: 'KPI Config', path: '/workspace/kpi-config' },
        { title: 'Scores', path: '/workspace/scores' },
        { title: 'Tenders', path: '/workspace/tenders' },
        { title: 'Requests', path: '/workspace/requests' },
        { title: 'Checklist Items', path: '/workspace/checklist-items' },
        { title: 'Comments', path: '/workspace/comments' },
        { title: 'Client Portal', path: '/workspace/client-portal' },
        { title: 'Supplier Portal', path: '/workspace/supplier-portal' },
        {
            title: 'Automation',
            icon: Zap,
            children: [
                { title: 'Auto Rules', path: '/workspace/auto-rules' },
                { title: 'Auto Task Settings', path: '/workspace/auto-task-settings' },
                { title: 'WISE Console', path: '/workspace/wise-console' },
                { title: 'WISE Rules', path: '/workspace/wise-rules' },
                { title: 'WISE Adjustments', path: '/workspace/wise-adjustments' },
            ],
        },
        {
            title: 'Config',
            icon: Settings,
            children: [
                { title: 'Workspace Config', path: '/workspace/config' },
                { title: 'Categories', path: '/workspace/categories' },
                { title: 'Templates', path: '/workspace/templates' },
                { title: 'Questionnaires', path: '/workspace/questionnaires' },
                { title: 'Questions', path: '/workspace/questions' },
            ],
        },
    ],
};
