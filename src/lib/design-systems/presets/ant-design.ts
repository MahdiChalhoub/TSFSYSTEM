/**
 * Ant Design System Preset
 * =========================
 * Based on Ant Design 5.x specifications
 * https://ant.design/docs/spec/introduce
 *
 * Philosophy:
 * - Enterprise-grade UI
 * - Professional and modern
 * - Efficient and focused
 * - Dense information layout
 */

import { DesignSystem } from "../design-system-framework";

export const ANT_DESIGN_SYSTEM: DesignSystem = {
  id: "ant-design",
  name: "Ant Design",
  description: "Enterprise-grade UI design system from Alibaba",
  author: "Ant Design Team",
  version: "5.0",

  colors: {
    light: {
      // Primary (Blue)
      primary: "#1677ff",
      primaryHover: "#4096ff",
      primaryActive: "#0958d9",
      primaryDisabled: "#d9d9d9",

      // Semantic
      success: "#52c41a",
      successHover: "#73d13d",
      warning: "#faad14",
      warningHover: "#ffc53d",
      error: "#ff4d4f",
      errorHover: "#ff7875",
      info: "#1677ff",
      infoHover: "#4096ff",

      // Neutrals
      text: "rgba(0, 0, 0, 0.88)",
      textSecondary: "rgba(0, 0, 0, 0.65)",
      textDisabled: "rgba(0, 0, 0, 0.25)",
      background: "#ffffff",
      backgroundSecondary: "#fafafa",
      border: "#d9d9d9",
      borderHover: "#4096ff",
      divider: "rgba(5, 5, 5, 0.06)",

      // Surfaces
      surface: "#ffffff",
      surfaceHover: "#fafafa",
      surfaceActive: "#f5f5f5",
    },

    dark: {
      // Primary (Blue)
      primary: "#1668dc",
      primaryHover: "#3c89e8",
      primaryActive: "#1554ad",
      primaryDisabled: "#434343",

      // Semantic
      success: "#49aa19",
      successHover: "#6abe39",
      warning: "#d89614",
      warningHover: "#e8b339",
      error: "#dc4446",
      errorHover: "#e86e6b",
      info: "#1668dc",
      infoHover: "#3c89e8",

      // Neutrals
      text: "rgba(255, 255, 255, 0.85)",
      textSecondary: "rgba(255, 255, 255, 0.65)",
      textDisabled: "rgba(255, 255, 255, 0.30)",
      background: "#000000",
      backgroundSecondary: "#141414",
      border: "#424242",
      borderHover: "#3c89e8",
      divider: "rgba(253, 253, 253, 0.12)",

      // Surfaces
      surface: "#141414",
      surfaceHover: "#1f1f1f",
      surfaceActive: "#2a2a2a",
    },
  },

  typography: {
    fontFamily:
      "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontFamilyMono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace",

    sizes: {
      xs: 12,
      sm: 12,
      base: 14,
      lg: 16,
      xl: 18,
      "2xl": 20,
      "3xl": 24,
      "4xl": 30,
      "5xl": 38,
      "6xl": 46,
    },

    lineHeights: {
      tight: 1.35,
      normal: 1.5715,
      relaxed: 1.8,
      loose: 2,
    },

    fontWeights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  spacing: {
    scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96],
    aliases: {
      none: 0,
      xs: 4,
      sm: 8,
      md: 12,
      base: 16,
      lg: 20,
      xl: 24,
      "2xl": 32,
      "3xl": 40,
      "4xl": 48,
      "5xl": 64,
      "6xl": 80,
      "7xl": 96,
    },
  },

  borderRadius: {
    scale: [0, 2, 4, 6, 8, 16],
    aliases: {
      none: 0,
      sm: 2,
      base: 6,
      md: 6,
      lg: 8,
      xl: 16,
      full: 9999,
    },
  },

  shadows: {
    none: "none",
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02)",
    base: "0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08)",
    md: "0 6px 16px -8px rgba(0, 0, 0, 0.08), 0 9px 28px 0 rgba(0, 0, 0, 0.05)",
    lg: "0 9px 28px 8px rgba(0, 0, 0, 0.05), 0 12px 48px 16px rgba(0, 0, 0, 0.03)",
    xl: "0 12px 48px 16px rgba(0, 0, 0, 0.03), 0 16px 64px 24px rgba(0, 0, 0, 0.02)",
  },

  animations: {
    linear: "cubic-bezier(0, 0, 1, 1)",
    easeIn: "cubic-bezier(0.55, 0.055, 0.675, 0.19)",
    easeOut: "cubic-bezier(0.215, 0.61, 0.355, 1)",
    easeInOut: "cubic-bezier(0.645, 0.045, 0.355, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },

  components: {
    button: {
      height: { sm: 24, base: 32, lg: 40 },
      padding: { sm: "0 7px", base: "4px 15px", lg: "6px 15px" },
      borderRadius: 6,
      fontSize: { sm: 12, base: 14, lg: 16 },
      fontWeight: 400,
      transition: "all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)",
    },

    input: {
      height: { sm: 24, base: 32, lg: 40 },
      padding: "4px 11px",
      borderRadius: 6,
      borderWidth: 1,
      fontSize: 14,
    },

    card: {
      padding: { sm: 12, base: 16, lg: 24 },
      borderRadius: 8,
      shadow:
        "0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02)",
      border: "1px solid rgba(5, 5, 5, 0.06)",
    },

    table: {
      rowHeight: { compact: 40, comfortable: 56 },
      headerHeight: 56,
      cellPadding: "16px",
      borderWidth: 1,
    },

    modal: {
      borderRadius: 8,
      shadow:
        "0 6px 16px -8px rgba(0, 0, 0, 0.08), 0 9px 28px 0 rgba(0, 0, 0, 0.05)",
      padding: 24,
      widths: { sm: 416, base: 520, lg: 640, xl: 800 },
    },

    badge: {
      height: { sm: 20, base: 22 },
      padding: "0 7px",
      borderRadius: 11,
      fontSize: 12,
      fontWeight: 400,
    },
  },

  layout: {
    grid: {
      columns: 24, // Ant Design uses 24-column grid
      gutter: 16,
    },

    page: {
      paddingX: { mobile: 16, tablet: 24, desktop: 24 },
      paddingY: { mobile: 16, tablet: 24, desktop: 24 },
      maxWidth: 1200,
    },

    section: {
      gap: 16,
    },
  },

  principles: [
    "Natural - User interface should be natural and intuitive",
    "Certain - Designers should make user interfaces more certain",
    "Meaningful - User interfaces should be meaningful",
    "Growing - Designers and developers should keep optimizing",
  ],

  customVariables: {
    "ant-motion-duration-slow": "0.3s",
    "ant-motion-duration-mid": "0.2s",
    "ant-motion-duration-fast": "0.1s",
  },
};
