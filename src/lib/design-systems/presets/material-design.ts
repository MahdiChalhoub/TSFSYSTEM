/**
 * Material Design 3 System Preset
 * ================================
 * Based on Material Design 3 (Material You)
 * https://m3.material.io/
 *
 * Philosophy:
 * - Adaptive and personal
 * - Beautiful and expressive
 * - Dynamic color system
 * - Elevated surfaces
 */

import { DesignSystem } from "../design-system-framework";

export const MATERIAL_DESIGN_SYSTEM: DesignSystem = {
  id: "material-design",
  name: "Material Design 3",
  description: "Google's open-source design system (Material You)",
  author: "Google",
  version: "3.0",

  colors: {
    light: {
      // Primary (Purple)
      primary: "#6750A4",
      primaryHover: "#7965AF",
      primaryActive: "#5639A1",
      primaryDisabled: "#E6E1E5",

      // Secondary
      secondary: "#625B71",
      secondaryHover: "#7A7289",

      // Semantic
      success: "#2E7D32",
      successHover: "#4CAF50",
      warning: "#F57C00",
      warningHover: "#FF9800",
      error: "#B3261E",
      errorHover: "#DC362E",
      info: "#0288D1",
      infoHover: "#03A9F4",

      // Neutrals
      text: "#1C1B1F",
      textSecondary: "#49454F",
      textDisabled: "#C2C0C4",
      background: "#FFFBFE",
      backgroundSecondary: "#F3EDF7",
      border: "#79747E",
      borderHover: "#6750A4",
      divider: "#E7E0EC",

      // Surfaces
      surface: "#FFFBFE",
      surfaceHover: "#F3EDF7",
      surfaceActive: "#E6E1E5",
    },

    dark: {
      // Primary (Purple)
      primary: "#D0BCFF",
      primaryHover: "#E0C9FF",
      primaryActive: "#C0AEEF",
      primaryDisabled: "#313033",

      // Secondary
      secondary: "#CCC2DC",
      secondaryHover: "#DCD2EC",

      // Semantic
      success: "#81C784",
      successHover: "#A5D6A7",
      warning: "#FFB74D",
      warningHover: "#FFCC80",
      error: "#F2B8B5",
      errorHover: "#F5C9C6",
      info: "#4FC3F7",
      infoHover: "#81D4FA",

      // Neutrals
      text: "#E6E1E5",
      textSecondary: "#CAC4D0",
      textDisabled: "#625B71",
      background: "#1C1B1F",
      backgroundSecondary: "#2B2930",
      border: "#938F99",
      borderHover: "#D0BCFF",
      divider: "#49454F",

      // Surfaces
      surface: "#1C1B1F",
      surfaceHover: "#2B2930",
      surfaceActive: "#363438",
    },
  },

  typography: {
    fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
    fontFamilyMono: "'Roboto Mono', monospace",

    sizes: {
      xs: 11,
      sm: 12,
      base: 14,
      lg: 16,
      xl: 18,
      "2xl": 20,
      "3xl": 24,
      "4xl": 34,
      "5xl": 45,
      "6xl": 57,
    },

    lineHeights: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.7,
      loose: 2,
    },

    fontWeights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },

    letterSpacing: {
      tight: "-0.01em",
      normal: "0em",
      wide: "0.025em",
    },
  },

  spacing: {
    scale: [0, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64],
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
    },
  },

  borderRadius: {
    scale: [0, 4, 8, 12, 16, 20, 28],
    aliases: {
      none: 0,
      sm: 4,
      base: 12,
      md: 12,
      lg: 16,
      xl: 28,
      full: 9999,
    },
  },

  shadows: {
    none: "none",
    sm: "0px 1px 2px rgba(0, 0, 0, 0.30), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)",
    base: "0px 1px 2px rgba(0, 0, 0, 0.30), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)",
    md: "0px 4px 8px 3px rgba(0, 0, 0, 0.15), 0px 1px 3px rgba(0, 0, 0, 0.30)",
    lg: "0px 6px 10px 4px rgba(0, 0, 0, 0.15), 0px 2px 3px rgba(0, 0, 0, 0.30)",
    xl: "0px 8px 12px 6px rgba(0, 0, 0, 0.15), 0px 4px 4px rgba(0, 0, 0, 0.30)",
  },

  animations: {
    linear: "cubic-bezier(0, 0, 1, 1)",
    easeIn: "cubic-bezier(0.4, 0, 1, 1)", // Standard deceleration
    easeOut: "cubic-bezier(0, 0, 0.2, 1)", // Standard acceleration
    easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)", // Standard
    spring: "cubic-bezier(0.05, 0.7, 0.1, 1)", // Emphasized
  },

  components: {
    button: {
      height: { sm: 32, base: 40, lg: 48 },
      padding: { sm: "0 12px", base: "0 24px", lg: "0 28px" },
      borderRadius: 20,
      fontSize: { sm: 12, base: 14, lg: 16 },
      fontWeight: 500,
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    },

    input: {
      height: { sm: 40, base: 56, lg: 64 },
      padding: "16px",
      borderRadius: 4,
      borderWidth: 1,
      fontSize: 16,
    },

    card: {
      padding: { sm: 12, base: 16, lg: 24 },
      borderRadius: 12,
      shadow:
        "0px 1px 2px rgba(0, 0, 0, 0.30), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)",
      border: "none",
    },

    table: {
      rowHeight: { compact: 48, comfortable: 56 },
      headerHeight: 56,
      cellPadding: "16px",
      borderWidth: 1,
    },

    modal: {
      borderRadius: 28,
      shadow:
        "0px 8px 12px 6px rgba(0, 0, 0, 0.15), 0px 4px 4px rgba(0, 0, 0, 0.30)",
      padding: 24,
      widths: { sm: 312, base: 560, lg: 720, xl: 960 },
    },

    badge: {
      height: { sm: 16, base: 20 },
      padding: "0 4px",
      borderRadius: 8,
      fontSize: 11,
      fontWeight: 500,
    },
  },

  layout: {
    grid: {
      columns: 12,
      gutter: 16,
    },

    page: {
      paddingX: { mobile: 16, tablet: 24, desktop: 24 },
      paddingY: { mobile: 16, tablet: 24, desktop: 24 },
      maxWidth: 1280,
    },

    section: {
      gap: 24,
    },
  },

  principles: [
    "Material is the metaphor - Unified theory of a rationalized space",
    "Bold, graphic, intentional - Print design methods guide visual treatments",
    "Motion provides meaning - Motion respects and reinforces the user as the prime mover",
  ],

  customVariables: {
    "md3-motion-duration-short1": "50ms",
    "md3-motion-duration-short2": "100ms",
    "md3-motion-duration-medium1": "250ms",
    "md3-motion-duration-medium2": "300ms",
    "md3-motion-duration-long1": "450ms",
    "md3-motion-duration-long2": "600ms",
  },
};
