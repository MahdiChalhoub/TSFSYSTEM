export interface TemplateInfo {
    key: string; name: string; region: string; description: string
    icon: string; accent_color: string; is_system: boolean; is_custom: boolean
    account_count: number; posting_rule_count: number
    version?: string; last_updated?: string
}

export interface Props {
    templates: TemplateInfo[]
    templatesMap: Record<string, any>
    migrationMaps: Record<string, Record<string, string>>
}
