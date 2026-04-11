export type TreeNode<T> = T & {
    children?: TreeNode<T>[];
};

export function buildTree<T extends { id: number; parent?: number | null; base_unit?: number | null }>(
    items: T[], 
    parentKey: 'parent' | 'base_unit' = 'parent'
): TreeNode<T>[] {
    const map = new Map<number, TreeNode<T>>();
    const roots: TreeNode<T>[] = [];

    // First pass: create map of all items
    items.forEach(item => {
        map.set(item.id, { ...item, children: [] });
    });

    // Second pass: build hierarchy
    items.forEach(item => {
        const node = map.get(item.id)!;
        const parentId = item[parentKey];

        if (parentId && map.has(parentId)) {
            const parent = map.get(parentId)!;
            parent.children = parent.children || [];
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    });

    return roots;
}
