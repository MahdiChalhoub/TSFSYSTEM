export type MenuItem = {
    title: string;
    icon?: any;
    path?: string;
    module?: string;
    stage?: string;
    visibility?: string;
    children?: MenuItem[];
};
