import {
    ShieldCheck,
    Globe,
    BarChart3,
    Building2,
    Shield,
    ServerCog,
    Bot,
    Wrench,
} from 'lucide-react';
import type { MenuItem } from './types';

export const saasControl: MenuItem = {
    title: 'SaaS Control',
    icon: ShieldCheck,
    visibility: 'saas',
    children: [
        { title: 'SaaS Home', path: '/saas-home', icon: Globe },
        { title: 'SaaS Dashboard', path: '/dashboard', icon: BarChart3 },
        {
            title: 'Organizations',
            icon: Building2,
            children: [
                { title: 'Organizations', path: '/organizations' },
                { title: 'Registrations', path: '/organizations/registrations' },
                { title: 'Instance Switcher', path: '/switcher' },
                { title: 'Subscription Plans', path: '/subscription-plans' },
            ],
        },
        {
            title: 'Reference Data',
            icon: Globe,
            children: [
                { title: 'Countries & Regions', path: '/countries' },
                { title: 'Currencies', path: '/currencies' },
                { title: 'Country Tax Templates', path: '/country-tax-templates' },
                { title: 'E-Invoice Standards', path: '/e-invoice-standards' },
                { title: 'Listview Policies', path: '/listview-policies' },
            ],
        },
        {
            title: 'Infrastructure',
            icon: Shield,
            children: [
                { title: 'Platform Health', path: '/health' },
                { title: 'Kernel Manager', path: '/kernel' },
                { title: 'Kernel Updates', path: '/updates' },
                { title: 'Global Registry', path: '/modules' },
                { title: 'AES-256 Encryption', path: '/encryption' },
                {
                    title: 'Connector',
                    icon: ServerCog,
                    children: [
                        { title: 'Connector Control', path: '/connector' },
                        { title: 'Connector Buffer', path: '/connector/buffer' },
                        { title: 'Connector Logs', path: '/connector/logs' },
                        { title: 'Connector Policies', path: '/connector/policies' },
                    ],
                },
            ],
        },
        {
            title: 'AI & Automation',
            icon: Bot,
            children: [
                { title: 'MCP Dashboard', path: '/mcp' },
                { title: 'MCP Chat', path: '/mcp/chat' },
                { title: 'Conversations', path: '/mcp/conversations' },
                { title: 'Agents', path: '/mcp/agents' },
                { title: 'Agent Logs', path: '/mcp/agent-logs' },
                { title: 'Providers', path: '/mcp/providers' },
                { title: 'Tools', path: '/mcp/tools' },
                { title: 'Usage', path: '/mcp/usage' },
                { title: 'MCP Settings', path: '/mcp/settings' },
            ],
        },
        {
            title: 'Developer',
            icon: Wrench,
            children: [
                { title: 'Theme Demo', path: '/theme-demo' },
                { title: 'UI Kit', path: '/ui-kit' },
            ],
        },
    ],
};
