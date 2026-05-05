/**
 * Unified Theme Engine - Type Definitions
 * =======================================
 * Complete TypeScript types for the theme system.
 */

// ============================================================================
// THEME PRESET TYPES
// ============================================================================

export type ThemeCategory = 'professional' | 'creative' | 'efficiency' | 'specialized' | 'design-system' | 'custom'

export type ColorMode = 'dark' | 'light' | 'auto'

export interface ThemePreset {
  id: number
  slug: string
  name: string
  description: string
  category: ThemeCategory
  isSystem: boolean
  isActive: boolean
  isDefault: boolean
  tags: string[]
  presetData: ThemePresetData
  usageCount?: number
  lastUsedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface ThemePresetData {
  colors: {
    dark: ColorScheme
    light: ColorScheme
  }
  layout: LayoutConfig
  components: ComponentConfig
  navigation: NavigationConfig
}

// ============================================================================
// COLOR SCHEME
// ============================================================================

export interface ColorScheme {
  primary: string
  primaryDark: string
  bg: string
  surface: string
  surfaceHover: string
  text: string
  textMuted: string
  border: string
  success?: string
  warning?: string
  error?: string
  accent?: string
}

// ============================================================================
// LAYOUT CONFIG
// ============================================================================

export interface LayoutConfig {
  density: 'sparse' | 'medium' | 'dense'
  whitespace: 'generous' | 'balanced' | 'minimal'
  structure: 'single-column' | 'two-column' | 'grid' | 'fullscreen'
  spacing: {
    container: string
    section: string
    card: string
    element: string
  }
}

// ============================================================================
// COMPONENT CONFIG
// ============================================================================

export interface ComponentConfig {
  cards: CardConfig
  buttons: ButtonConfig
  inputs: InputConfig
  typography: TypographyConfig
  tables: TableConfig
  modals: ModalConfig
  forms: FormConfig
  tabs: TabsConfig
  badges: BadgeConfig
  alerts: AlertConfig
}

export interface CardConfig {
  borderRadius: string
  shadow: string
  border: string
  padding: string
  style: 'subtle' | 'prominent' | 'none'
}

export interface ButtonConfig {
  borderRadius: string
  height: string
  padding: string
  fontSize: string
  fontWeight: string
}

export interface InputConfig {
  borderRadius: string
  height: string
  padding: string
  fontSize: string
  border: string
}

export interface TypographyConfig {
  headingFont: string
  bodyFont: string
  h1Size: string
  h2Size: string
  h3Size: string
  bodySize: string
  smallSize: string
  fontWeight: 'light' | 'normal' | 'medium' | 'semibold' | 'bold'
  lineHeight: 'tight' | 'normal' | 'relaxed'
  letterSpacing: 'tight' | 'normal' | 'wide'
}

export interface TableConfig {
  rowHeight: string
  headerStyle: 'bold' | 'subtle' | 'elevated'
  borderStyle: 'none' | 'rows' | 'cells' | 'outer'
  striped: boolean
  hoverEffect: boolean
  density: 'compact' | 'comfortable' | 'spacious'
}

export interface ModalConfig {
  maxWidth: string
  borderRadius: string
  padding: string
  backdrop: 'blur' | 'dark' | 'light'
  animation: 'fade' | 'scale' | 'slide'
  shadow: string
}

export interface FormConfig {
  labelPosition: 'top' | 'left' | 'inline'
  labelStyle: 'bold' | 'normal' | 'muted'
  fieldSpacing: string
  groupSpacing: string
  validationStyle: 'inline' | 'tooltip' | 'summary'
}

export interface TabsConfig {
  style: 'underline' | 'pills' | 'boxed' | 'minimal'
  size: 'sm' | 'md' | 'lg'
  spacing: string
  activeIndicator: 'underline' | 'background' | 'border'
}

export interface BadgeConfig {
  size: 'xs' | 'sm' | 'md' | 'lg'
  style: 'solid' | 'outline' | 'soft' | 'minimal'
  borderRadius: string
  fontWeight: string
  textTransform: 'none' | 'uppercase' | 'capitalize'
}

export interface AlertConfig {
  style: 'filled' | 'outlined' | 'soft' | 'minimal'
  borderRadius: string
  padding: string
  iconSize: string
  showIcon: boolean
}

// ============================================================================
// NAVIGATION CONFIG
// ============================================================================

export interface NavigationConfig {
  position: 'top' | 'side' | 'hidden'
  style: 'minimal' | 'compact' | 'expanded'
  width: string
  collapsible: boolean
}

// ============================================================================
// USER PREFERENCE
// ============================================================================

export interface UserThemePreference {
  id: number
  activeTheme: number | null
  colorMode: ColorMode
  customOverrides: Record<string, any>
  activeThemeDetails?: ThemePreset
  updatedAt?: string
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ThemesListResponse {
  system: ThemePreset[]
  custom: ThemePreset[]
  current: {
    theme_slug: string
    color_mode: ColorMode
  }
}

export interface CurrentThemeResponse {
  theme: ThemePreset
  color_mode: ColorMode
  custom_overrides: Record<string, any>
}

export interface ThemeActivateResponse {
  status: 'activated'
  theme_slug: string
  theme_name: string
}

export interface ColorModeToggleResponse {
  color_mode: ColorMode
  status: 'updated'
}

// ============================================================================
// THEME CREATION TYPES
// ============================================================================

export interface CreateThemeInput {
  name: string
  description?: string
  category: ThemeCategory
  preset_data: ThemePresetData
  tags?: string[]
}

export interface ImportThemeInput {
  name: string
  description?: string
  category: ThemeCategory
  preset_data: ThemePresetData
  tags?: string[]
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface UnifiedThemeEngineContextValue {
  // Current state
  currentTheme: ThemePreset | null
  colorMode: ColorMode
  isLoading: boolean
  error: string | null

  // Available themes
  systemThemes: ThemePreset[]
  customThemes: ThemePreset[]
  allThemes: ThemePreset[]

  // Computed values
  activeColors: ColorScheme
  activeLayout: LayoutConfig
  activeComponents: ComponentConfig
  activeNavigation: NavigationConfig

  // Actions
  setTheme: (slug: string) => Promise<void>
  toggleColorMode: () => Promise<void>
  setColorMode: (mode: ColorMode) => Promise<void>
  createTheme: (theme: CreateThemeInput) => Promise<ThemePreset>
  updateTheme: (id: number, updates: Partial<ThemePreset>) => Promise<ThemePreset>
  deleteTheme: (id: number) => Promise<void>
  refreshThemes: () => Promise<void>

  // Utilities
  exportTheme: (slug: string) => Promise<string>
  importTheme: (json: string) => Promise<ThemePreset>
  getThemeBySlug: (slug: string) => Promise<ThemePreset | undefined>
  getThemesByCategory: (category: ThemeCategory) => Promise<ThemePreset[]>
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface ThemeExport {
  name: string
  description: string
  category: ThemeCategory
  preset_data: ThemePresetData
  tags: string[]
  exported_at: string
  version: string
}

export interface ThemeValidationResult {
  valid: boolean
  errors: string[]
}

// ============================================================================
// CSS VARIABLE MAPPING
// ============================================================================

export const CSS_VARIABLES = {
  // Colors - MUST match globals.css app-* variable names
  colors: {
    primary: '--app-primary',
    primaryDark: '--app-primary-dark',
    bg: '--app-bg',
    surface: '--app-surface',
    surfaceHover: '--app-surface-hover',
    text: '--app-foreground',
    textMuted: '--app-muted-foreground',
    border: '--app-border',
    success: '--app-success',
    warning: '--app-warning',
    error: '--app-error',
    accent: '--app-accent',
  },
  // Layout
  layout: {
    containerPadding: '--layout-container-padding',
    sectionSpacing: '--layout-section-spacing',
    cardPadding: '--layout-card-padding',
    elementGap: '--layout-element-gap',
  },
  // Components
  components: {
    cardRadius: '--card-radius',
    cardShadow: '--card-shadow',
    cardBorder: '--card-border',
    cardPadding: '--card-padding',
    buttonRadius: '--button-radius',
    buttonHeight: '--button-height',
    buttonPadding: '--button-padding',
    buttonFontSize: '--button-font-size',
    buttonFontWeight: '--button-font-weight',
    inputRadius: '--input-radius',
    inputHeight: '--input-height',
    inputPadding: '--input-padding',
    inputFontSize: '--input-font-size',
    inputBorder: '--input-border',
  },
  // Typography
  typography: {
    headingFont: '--font-heading',
    bodyFont: '--font-body',
    h1Size: '--font-size-h1',
    h2Size: '--font-size-h2',
    h3Size: '--font-size-h3',
    bodySize: '--font-size-body',
    smallSize: '--font-size-small',
  },
  // Navigation
  navigation: {
    width: '--nav-width',
  },
} as const
