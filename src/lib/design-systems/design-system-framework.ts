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

  // ── 1. Legacy color variables (kept for backward compat) ──
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

  // ── 2. BRIDGE: Font Family ──────────────────────────────────
  // globals.css reads: font-family: var(--app-font, 'Outfit', sans-serif)
  root.style.setProperty("--app-font", system.typography.fontFamily);
  root.style.setProperty("--font-family", system.typography.fontFamily);
  if (system.typography.fontFamilyMono) {
    root.style.setProperty("--app-font-mono", system.typography.fontFamilyMono);
  }

  // ── 3. BRIDGE: Border Radius ────────────────────────────────
  // globals.css `:root { --radius: 0.625rem }` cascades to all Tailwind rounded-* via @theme inline
  const baseRadius = system.borderRadius.aliases.base || 6;
  root.style.setProperty("--radius", `${baseRadius}px`);

  // Component-specific radii for direct style usage
  root.style.setProperty("--ds-radius-btn", `${system.components.button.borderRadius}px`);
  root.style.setProperty("--ds-radius-input", `${system.components.input.borderRadius}px`);
  root.style.setProperty("--ds-radius-card", `${system.components.card.borderRadius}px`);
  root.style.setProperty("--ds-radius-modal", `${system.components.modal.borderRadius}px`);
  root.style.setProperty("--ds-radius-badge", `${system.components.badge.borderRadius}px`);

  // ── 4. BRIDGE: Shadows ──────────────────────────────────────
  // Used by Tailwind shadow-* utilities
  root.style.setProperty("--shadow-sm", system.shadows.sm);
  root.style.setProperty("--shadow-base", system.shadows.base);
  root.style.setProperty("--shadow-md", system.shadows.md);
  root.style.setProperty("--shadow-lg", system.shadows.lg);
  root.style.setProperty("--shadow-xl", system.shadows.xl);
  if (system.shadows["2xl"]) {
    root.style.setProperty("--shadow-2xl", system.shadows["2xl"]);
  }
  // Card-specific shadow for card-kpi / card-section
  root.style.setProperty("--ds-shadow-card", system.components.card.shadow);

  // ── 5. BRIDGE: Typography Scale ─────────────────────────────
  root.style.setProperty("--ds-font-size-xs", `${system.typography.sizes.xs}px`);
  root.style.setProperty("--ds-font-size-sm", `${system.typography.sizes.sm}px`);
  root.style.setProperty("--ds-font-size-base", `${system.typography.sizes.base}px`);
  root.style.setProperty("--ds-font-size-lg", `${system.typography.sizes.lg}px`);
  root.style.setProperty("--ds-font-size-xl", `${system.typography.sizes.xl}px`);
  root.style.setProperty("--font-size-base", `${system.typography.sizes.base}px`);

  // ── 6. BRIDGE: Spacing Scale ────────────────────────────────
  Object.entries(system.spacing.aliases).forEach(([key, value]) => {
    root.style.setProperty(`--spacing-${key}`, `${value}px`);
    root.style.setProperty(`--ds-spacing-${key}`, `${value}px`);
  });

  // ── 7. BRIDGE: Animation Curves ─────────────────────────────
  root.style.setProperty("--ds-ease-default", system.animations.easeInOut);
  root.style.setProperty("--ds-ease-in", system.animations.easeIn);
  root.style.setProperty("--ds-ease-out", system.animations.easeOut);
  root.style.setProperty("--ds-transition-btn", system.components.button.transition);

  // ── 8. BRIDGE: Component Sizes ──────────────────────────────
  root.style.setProperty("--ds-btn-height-sm", `${system.components.button.height.sm}px`);
  root.style.setProperty("--ds-btn-height", `${system.components.button.height.base}px`);
  root.style.setProperty("--ds-btn-height-lg", `${system.components.button.height.lg}px`);
  root.style.setProperty("--ds-input-height-sm", `${system.components.input.height.sm}px`);
  root.style.setProperty("--ds-input-height", `${system.components.input.height.base}px`);
  root.style.setProperty("--ds-input-height-lg", `${system.components.input.height.lg}px`);

  // Border radius aliases
  Object.entries(system.borderRadius.aliases).forEach(([key, value]) => {
    root.style.setProperty(`--radius-${key}`, `${value}px`);
  });

  // ── 9. Custom variables if any ──────────────────────────────
  if (system.customVariables) {
    Object.entries(system.customVariables).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }

  // ── 10. Data attribute for CSS-targeted rules ───────────────
  root.setAttribute("data-design-system", system.id);
  root.setAttribute("data-color-mode", colorMode);

  // ── 11. Inject <style> that directly overrides Tailwind's compiled classes ──
  //
  // Tailwind v4 with @theme inline BAKES values at build time — shadow-*, rounded-*,
  // font-*, transition-* are all static. Runtime CSS var changes have ZERO effect.
  //
  // Fix: [data-design-system="id"] .class — specificity (0,2,0) beats Tailwind's (0,1,0).
  // data-design-system lives on <html>, so all page elements are matched.
  //
  // CSS custom properties (var() references in components) still use :root !important.
  const cardR  = system.components.card.borderRadius;
  const btnR   = system.components.button.borderRadius;
  const inputR = system.components.input.borderRadius;
  const modalR = system.components.modal.borderRadius;
  const base   = baseRadius;
  const id     = system.id;

  // ── Border radius tiers from base ──
  const rSm  = Math.max(0, base - 4);
  const rMd  = Math.max(0, base - 2);
  const rLg  = base;
  const rXl  = base + 4;
  const r2xl = base + 8;
  const r3xl = base + 12;
  const r4xl = base + 16;

  // ── Font family (strip CSS var() wrapper for direct body use) ──
  const fontStack = system.typography.fontFamily;

  // ── Component heights ──
  const btnH   = system.components.button.height.base;
  const btnHSm = system.components.button.height.sm;
  const btnHLg = system.components.button.height.lg;
  const inputH   = system.components.input.height.base;
  const inputHSm = system.components.input.height.sm;
  const inputHLg = system.components.input.height.lg;

  // ── Table density ──
  const rowCompact = system.components.table.rowHeight.compact;
  const rowComfy   = system.components.table.rowHeight.comfortable;
  const headerH    = system.components.table.headerHeight;
  const cellPad    = system.components.table.cellPadding;

  // ── Typography ──
  const fwNormal  = system.typography.fontWeights.normal;
  const fwMedium  = system.typography.fontWeights.medium;
  const fwSemibold = system.typography.fontWeights.semibold;
  const fwBold    = system.typography.fontWeights.bold;
  const fsBase    = system.typography.sizes.base;
  const fsSm      = system.typography.sizes.sm;
  const fsLg      = system.typography.sizes.lg;
  const lhNormal  = system.typography.lineHeights.normal;

  // ── Shadows ──
  const shadowSm  = system.shadows.sm;
  const shadowBase = system.shadows.base;
  const shadowMd  = system.shadows.md;
  const shadowLg  = system.shadows.lg;
  const shadowXl  = system.shadows.xl;

  // ── Transitions ──
  const btnTransition = system.components.button.transition;
  const easeDefault   = system.animations.easeInOut;

  const styleId = 'tsf-ds-shape-overrides';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    /* ════════════════════════════════════════════════════════════════
       TSF Design System Override Sheet
       Specificity (0,2,0) beats Tailwind v4 compiled classes (0,1,0)
       ════════════════════════════════════════════════════════════════ */

    /* ── 1. Border Radius ─────────────────────────────────────────── */
    [data-design-system="${id}"] .rounded-none { border-radius: 0px; }
    [data-design-system="${id}"] .rounded-sm   { border-radius: ${rSm}px; }
    [data-design-system="${id}"] .rounded      { border-radius: ${rLg}px; }
    [data-design-system="${id}"] .rounded-md   { border-radius: ${rMd}px; }
    [data-design-system="${id}"] .rounded-lg   { border-radius: ${rLg}px; }
    [data-design-system="${id}"] .rounded-xl   { border-radius: ${rXl}px; }
    [data-design-system="${id}"] .rounded-2xl  { border-radius: ${r2xl}px; }
    [data-design-system="${id}"] .rounded-3xl  { border-radius: ${r3xl}px; }
    [data-design-system="${id}"] .rounded-4xl  { border-radius: ${r4xl}px; }
    [data-design-system="${id}"] .rounded-full { border-radius: 9999px; }

    /* ── 2. Shadows ───────────────────────────────────────────────── */
    [data-design-system="${id}"] .shadow-none { box-shadow: none; }
    [data-design-system="${id}"] .shadow-sm   { box-shadow: ${shadowSm}; }
    [data-design-system="${id}"] .shadow      { box-shadow: ${shadowBase}; }
    [data-design-system="${id}"] .shadow-md   { box-shadow: ${shadowMd}; }
    [data-design-system="${id}"] .shadow-lg   { box-shadow: ${shadowLg}; }
    [data-design-system="${id}"] .shadow-xl   { box-shadow: ${shadowXl}; }

    /* ── 3. Typography — font family ──────────────────────────────── */
    /* Rely on CSS inheritance — set on html+body, everything inherits.
       Avoid element-type selectors (div, span, etc.) which raise specificity to (0,1,1)
       and can override Tailwind layout utilities at (0,1,0). */
    [data-design-system="${id}"] { font-family: ${fontStack}; }
    [data-design-system="${id}"] body { font-family: ${fontStack}; }
    [data-design-system="${id}"] .font-sans { font-family: ${fontStack}; }

    /* ── 4. Font sizes ────────────────────────────────────────────── */
    [data-design-system="${id}"] .text-sm   { font-size: ${fsSm}px; line-height: ${lhNormal}; }
    [data-design-system="${id}"] .text-base { font-size: ${fsBase}px; line-height: ${lhNormal}; }
    [data-design-system="${id}"] .text-lg   { font-size: ${fsLg}px; line-height: ${lhNormal}; }

    /* ── 5. Font weights ──────────────────────────────────────────── */
    [data-design-system="${id}"] .font-normal   { font-weight: ${fwNormal}; }
    [data-design-system="${id}"] .font-medium   { font-weight: ${fwMedium}; }
    [data-design-system="${id}"] .font-semibold { font-weight: ${fwSemibold}; }
    [data-design-system="${id}"] .font-bold     { font-weight: ${fwBold}; }

    /* ── 6. Transitions ───────────────────────────────────────────── */
    /* Note: btnTransition already includes "all" prefix (e.g. "all 0.2s ease-in-out") */
    [data-design-system="${id}"] .transition-all,
    [data-design-system="${id}"] .transition     { transition: ${btnTransition}; }
    [data-design-system="${id}"] .transition-colors { transition: color, background-color, border-color, fill, stroke ${btnTransition.replace(/^all\s+/, '')}; }
    [data-design-system="${id}"] .transition-shadow { transition: box-shadow ${btnTransition.replace(/^all\s+/, '')}; }
    [data-design-system="${id}"] .transition-transform { transition: transform ${btnTransition.replace(/^all\s+/, '')}; }

    /* ── 7. Button heights & padding ──────────────────────────────── */
    [data-design-system="${id}"] .btn-sm,
    [data-design-system="${id}"] [data-size="sm"] button,
    [data-design-system="${id}"] button.btn-sm  { height: ${btnHSm}px; min-height: ${btnHSm}px; }
    [data-design-system="${id}"] .btn,
    [data-design-system="${id}"] button.btn     { height: ${btnH}px; min-height: ${btnH}px; }
    [data-design-system="${id}"] .btn-lg,
    [data-design-system="${id}"] button.btn-lg  { height: ${btnHLg}px; min-height: ${btnHLg}px; }

    /* ── 8. Input heights ─────────────────────────────────────────── */
    [data-design-system="${id}"] input.input-sm,
    [data-design-system="${id}"] .input-sm      { height: ${inputHSm}px; }
    [data-design-system="${id}"] input,
    [data-design-system="${id}"] .input         { height: ${inputH}px; }
    [data-design-system="${id}"] input.input-lg,
    [data-design-system="${id}"] .input-lg      { height: ${inputHLg}px; }

    /* ── 9. Table density ─────────────────────────────────────────── */
    [data-design-system="${id}"] th { height: ${headerH}px; padding: ${cellPad}; }
    [data-design-system="${id}"] td { padding: ${cellPad}; }
    [data-design-system="${id}"] tr { min-height: ${rowComfy}px; }
    [data-design-system="${id}"] .table-compact tr { min-height: ${rowCompact}px; }

    /* ── 10. CSS custom properties — used by component var() refs ─── */
    /* !important beats AppThemeProvider's normal inline setProperty() */
    :root {
      --app-radius:        ${cardR}px !important;
      --card-radius:       ${cardR}px !important;
      --button-radius:     ${btnR}px !important;
      --input-radius:      ${inputR}px !important;
      --modal-radius:      ${modalR}px !important;

      --app-font:          ${fontStack} !important;
      --app-font-display:  ${fontStack} !important;
      --font-family:       ${fontStack} !important;

      --app-shadow-sm:     ${shadowSm} !important;
      --app-shadow-base:   ${shadowBase} !important;
      --app-shadow-md:     ${shadowMd} !important;
      --app-shadow-lg:     ${shadowLg} !important;
      --card-shadow:       ${system.components.card.shadow} !important;

      --ds-btn-height:     ${btnH}px !important;
      --ds-btn-height-sm:  ${btnHSm}px !important;
      --ds-btn-height-lg:  ${btnHLg}px !important;
      --ds-input-height:   ${inputH}px !important;
      --ds-input-height-sm:${inputHSm}px !important;
      --ds-input-height-lg:${inputHLg}px !important;

      --ds-ease-default:   ${easeDefault} !important;
      --ds-transition-btn: ${btnTransition} !important;

      --ds-font-size-sm:   ${fsSm}px !important;
      --ds-font-size-base: ${fsBase}px !important;
      --ds-font-size-lg:   ${fsLg}px !important;
      --font-size-base:    ${fsBase}px !important;

      --ds-fw-normal:      ${fwNormal} !important;
      --ds-fw-medium:      ${fwMedium} !important;
      --ds-fw-semibold:    ${fwSemibold} !important;
      --ds-fw-bold:        ${fwBold} !important;
    }
  `;

  console.log(`🎨 [DesignSystem] Applied: ${system.name} — font="${system.typography.fontFamily.split(',')[0]}" base=${base}px btn=${btnR}px btnH=${btnH}px shadow="${shadowSm.substring(0,30)}..."`);
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
