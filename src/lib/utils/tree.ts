export function buildTree(items: any[], parentIdKey: string = 'parent'): any[] {
    const map: Record<string | number, any> = {};
    const roots: any[] = [];

    items.forEach(item => {
        map[item.id] = { ...item, children: [] };
    });

    items.forEach(item => {
        const parentId = item[parentIdKey];
        if (parentId && map[parentId]) {
            map[parentId].children.push(map[item.id]);
        } else {
            roots.push(map[item.id]);
        }
    });

    return roots;
}
