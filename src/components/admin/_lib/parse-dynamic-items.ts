import { SidebarDynamicItem } from "@/types/erp";
import { getIcon } from "./icon-map";

export function parseDynamicItems(raw: SidebarDynamicItem[]): SidebarDynamicItem[] {
    return raw.map(item => {
        const moduleCode = item.module || 'core';
        const prefix = moduleCode !== 'core' ? `/m/${moduleCode}` : '';
        return {
            ...item,
            icon: getIcon(item.icon as string),
            path: item.path && !item.path.startsWith('/saas') ? `/saas${prefix}${item.path}` : item.path,
            children: item.children?.map((c: SidebarDynamicItem) => ({
                ...c,
                icon: c.icon ? getIcon(c.icon as string) : undefined,
                path: c.path && !c.path.startsWith('/saas') ? `/saas${prefix}${c.path}` : c.path,
            }))
        };
    });
}
