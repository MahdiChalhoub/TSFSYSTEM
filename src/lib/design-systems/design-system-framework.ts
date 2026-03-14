/**
 * TSF Multi-Design-System Framework
 * ==================================
 * Allows switching between complete design systems:
 * - Ant Design (Enterprise)
 * - Material Design (Google)
 * - Apple Human Interface Guidelines
 * - Tailwind Modern
 * - TSF Custom
 *
 * Each system defines:
 * - Complete component styling
 * - Spacing scale
 * - Color palette
 * - Typography
 * - Shadows
 * - Border radius
 * - Animation curves
 * - Layout rules
 */

export type DesignSystemId =
  | "ant-design"
  | "material-design"
  | "apple-hig"
  | "tailwind"
  | "tsf-custom";

export interface ColorPalette {
  // Primary colors
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryDisabled: string;

  // Secondary colors
  secondary?: string;
  secondaryHover?: string;

  // Semantic colors
  success: string;
  successHover: string;
  warning: string;
  warningHover: string;
  error: string;
  errorHover: string;
  info: string;
  infoHover: string;

  // Neutrals
  text: string;
  textSecondary: string;
  textDisabled: string;
  background: string;
  backgroundSecondary: string;
  border: string;
  borderHover: string;
  divider: string;

  // Surfaces
  surface: string;
  surfaceHover: string;
  surfaceActive: string;
}

export interface TypographyScale {
  fontFamily: string;
  fontFamilyMono?: string;

  sizes: {
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    "2xl": number;
    "3xl": number;
    "4xl": number;
    "5xl": number;
    "6xl": number;
  };

  lineHeights: {
    tight: number;
    normal: number;
    relaxed: number;
    loose: number;
  };

  fontWeights: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
    black?: number;
  };

  letterSpacing?: {
    tight: string;
    normal: string;
    wide: string;
  };
}

export interface SpacingScale {
  scale: number[]; // Base values in px
  aliases: Record<string, number>;
}

export interface BorderRadiusScale {
  scale: number[];
  aliases: Record<string, number>;
}

export interface ShadowScale {
  none: string;
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  "2xl"?: string;
  inner?: string;
}

export interface AnimationCurves {
  linear: string;
  easeIn: string;
  easeOut: string;
  easeInOut: string;
  spring?: string;
  bounce?: string;
}

export interface ComponentStyles {
  button: {
    height: { sm: number; base: number; lg: number };
    padding: { sm: string; base: string; lg: string };
    borderRadius: number;
    fontSize: { sm: number; base: number; lg: number };
    fontWeight: number;
    transition: string;
  };

  input: {
    height: { sm: number; base: number; lg: number };
    padding: string;
    borderRadius: number;
    borderWidth: number;
    fontSize: number;
  };

  card: {
    padding: { sm: number; base: number; lg: number };
    borderRadius: number;
    shadow: string;
    border: string;
  };

  table: {
    rowHeight: { compact: number; comfortable: number };
    headerHeight: number;
    cellPadding: string;
    borderWidth: number;
  };

  modal: {
    borderRadius: number;
    shadow: string;
    padding: number;
    widths: { sm: number; base: number; lg: number; xl: number };
  };

  badge: {
    height: { sm: number; base: number };
    padding: string;
    borderRadius: number;
    fontSize: number;
    fontWeight: number;
  };
}

export interface LayoutRules {
  grid: {
    columns: number;
    gutter: number;
  };

  page: {
    paddingX: { mobile: number; tablet: number; desktop: number };
    paddingY: { mobile: number; tablet: number; desktop: number };
    maxWidth: number;
  };

  section: {
    gap: number;
  };
}

/**
 * Complete Design System Definition
 */
export interface DesignSystem {
  id: DesignSystemId;
  name: string;
  description: string;
  author: string;
  version: string;

  // Core design tokens
  colors: {
    light: ColorPalette;
    dark: ColorPalette;
  };

  typography: TypographyScale;
  spacing: SpacingScale;
  borderRadius: BorderRadiusScale;
  shadows: ShadowScale;
  animations: AnimationCurves;

  // Component-specific styling
  components: ComponentStyles;

  // Layout system
  layout: LayoutRules;

  // Design principles (for documentation)
  principles?: string[];

  // Custom CSS variables (optional)
  customVariables?: Record<string, string>;
}

/**
 * Design System Registry
 */
export const DESIGN_SYSTEMS: Record<DesignSystemId, DesignSystem> = {
  "ant-design": null as any, // Will be imported from separate file
  "material-design": null as any,
  "apple-hig": null as any,
  "tailwind": null as any,
  "tsf-custom": null as any,
};

/**
 * Get design system by ID
 */
export function getDesignSystem(id: DesignSystemId): DesignSystem | undefined {
  return DESIGN_SYSTEMS[id];
}

/**
 * Get all available design systems
 */
export function getAllDesignSystems(): DesignSystem[] {
  return Object.values(DESIGN_SYSTEMS).filter(Boolean);
}

/**
 * Apply design system CSS variables to document
 */
export function applyDesignSystem(
  system: DesignSystem,
  colorMode: "light" | "dark" = "light"
): void {
  const root = document.documentElement;
  const colors = colorMode === "dark" ? system.colors.dark : system.colors.light;

  // Apply color variables
  root.style.setProperty("--color-primary", colors.primary);
  root.style.setProperty("--color-primary-hover", colors.primaryHover);
  root.style.setProperty("--color-success", colors.success);
  root.style.setProperty("--color-error", colors.error);
  root.style.setProperty("--color-warning", colors.warning);
  root.style.setProperty("--color-info", colors.info);
  root.style.setProperty("--color-text", colors.text);
  root.style.setProperty("--color-text-secondary", colors.textSecondary);
  root.style.setProperty("--color-background", colors.background);
  root.style.setProperty("--color-surface", colors.surface);
  root.style.setProperty("--color-border", colors.border);

  // Apply typography variables
  root.style.setProperty("--font-family", system.typography.fontFamily);
  root.style.setProperty("--font-size-base", `${system.typography.sizes.base}px`);

  // Apply spacing variables
  Object.entries(system.spacing.aliases).forEach(([key, value]) => {
    root.style.setProperty(`--spacing-${key}`, `${value}px`);
  });

  // Apply border radius variables
  Object.entries(system.borderRadius.aliases).forEach(([key, value]) => {
    root.style.setProperty(`--radius-${key}`, `${value}px`);
  });

  // Apply shadow variables
  Object.entries(system.shadows).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value);
  });

  // Apply custom variables if any
  if (system.customVariables) {
    Object.entries(system.customVariables).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }

  // Store current system ID
  root.setAttribute("data-design-system", system.id);
  root.setAttribute("data-color-mode", colorMode);
}

/**
 * Get current active design system
 */
export function getCurrentDesignSystem(): DesignSystemId | null {
  const root = document.documentElement;
  return root.getAttribute("data-design-system") as DesignSystemId | null;
}

/**
 * Get current color mode
 */
export function getCurrentColorMode(): "light" | "dark" {
  const root = document.documentElement;
  return (root.getAttribute("data-color-mode") as "light" | "dark") || "light";
}
