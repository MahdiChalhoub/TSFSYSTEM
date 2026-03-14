/**
 * Apple Human Interface Guidelines System
 * ========================================
 * Based on Apple's design principles for macOS/iOS
 * https://developer.apple.com/design/human-interface-guidelines/
 *
 * Philosophy:
 * - Clarity, Deference, Depth
 * - Clean and minimal
 * - Content-focused
 * - Consistent spacing (8pt grid)
 */

import { DesignSystem } from "../design-system-framework";

export const APPLE_HIG_SYSTEM: DesignSystem = {
  id: "apple-hig",
  name: "Apple Human Interface Guidelines",
  description: "Apple's design system for clean, content-focused interfaces",
  author: "Apple Inc.",
  version: "2024",

  colors: {
    light: {
      primary: "#007AFF",
      primaryHover: "#0051D5",
      primaryActive: "#003D99",
      primaryDisabled: "#C7C7CC",

      success: "#34C759",
      successHover: "#30B350",
      warning: "#FF9500",
      warningHover: "#FF8800",
      error: "#FF3B30",
      errorHover: "#FF2D21",
      info: "#5856D6",
      infoHover: "#4A48C4",

      text: "#000000",
      textSecondary: "#3C3C43",
      textDisabled: "#8E8E93",
      background: "#FFFFFF",
      backgroundSecondary: "#F2F2F7",
      border: "#C6C6C8",
      borderHover: "#007AFF",
      divider: "#E5E5EA",

      surface: "#FFFFFF",
      surfaceHover: "#F2F2F7",
      surfaceActive: "#E5E5EA",
    },

    dark: {
      primary: "#0A84FF",
      primaryHover: "#409CFF",
      primaryActive: "#006CE0",
      primaryDisabled: "#48484A",

      success: "#32D74B",
      successHover: "#64DF77",
      warning: "#FF9F0A",
      warningHover: "#FFB340",
      error: "#FF453A",
      errorHover: "#FF6961",
      info: "#5E5CE6",
      infoHover: "#7D7AFF",

      text: "#FFFFFF",
      textSecondary: "#EBEBF5",
      textDisabled: "#8E8E93",
      background: "#000000",
      backgroundSecondary: "#1C1C1E",
      border: "#38383A",
      borderHover: "#0A84FF",
      divider: "#38383A",

      surface: "#1C1C1E",
      surfaceHover: "#2C2C2E",
      surfaceActive: "#3A3A3C",
    },
  },

  typography: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif",
    fontFamilyMono: "'SF Mono', 'Monaco', monospace",

    sizes: {
      xs: 11, // Caption 2
      sm: 12, // Caption 1
      base: 14, // Footnote
      lg: 16, // Callout
      xl: 17, // Body
      "2xl": 20, // Title 3
      "3xl": 22, // Title 2
      "4xl": 28, // Title 1
      "5xl": 34, // Large Title
      "6xl": 40, // Display
    },

    lineHeights: {
      tight: 1.2,
      normal: 1.3,
      relaxed: 1.5,
      loose: 1.8,
    },

    fontWeights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900,
    },

    letterSpacing: {
      tight: "-0.005em",
      normal: "0em",
      wide: "0.01em",
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
    },
  },

  borderRadius: {
    scale: [0, 4, 6, 8, 10, 12, 16, 20],
    aliases: {
      none: 0,
      sm: 4,
      base: 8,
      md: 10,
      lg: 12,
      xl: 16,
      full: 9999,
    },
  },

  shadows: {
    none: "none",
    sm: "0 1px 3px rgba(0, 0, 0, 0.08)",
    base: "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
    md: "0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.05)",
    lg: "0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)",
    xl: "0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)",
  },

  animations: {
    linear: "cubic-bezier(0, 0, 1, 1)",
    easeIn: "cubic-bezier(0.42, 0, 1, 1)",
    easeOut: "cubic-bezier(0, 0, 0.58, 1)",
    easeInOut: "cubic-bezier(0.42, 0, 0.58, 1)",
    spring: "cubic-bezier(0.68, -0.55, 0.27, 1.55)",
  },

  components: {
    button: {
      height: { sm: 28, base: 34, lg: 44 },
      padding: { sm: "0 12px", base: "0 16px", lg: "0 20px" },
      borderRadius: 8,
      fontSize: { sm: 12, base: 14, lg: 17 },
      fontWeight: 600,
      transition: "all 0.15s cubic-bezier(0.42, 0, 0.58, 1)",
    },

    input: {
      height: { sm: 28, base: 34, lg: 44 },
      padding: "0 12px",
      borderRadius: 8,
      borderWidth: 1,
      fontSize: 17,
    },

    card: {
      padding: { sm: 12, base: 16, lg: 20 },
      borderRadius: 12,
      shadow: "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
      border: "none",
    },

    table: {
      rowHeight: { compact: 40, comfortable: 48 },
      headerHeight: 48,
      cellPadding: "12px 16px",
      borderWidth: 1,
    },

    modal: {
      borderRadius: 16,
      shadow: "0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)",
      padding: 20,
      widths: { sm: 320, base: 480, lg: 640, xl: 800 },
    },

    badge: {
      height: { sm: 18, base: 20 },
      padding: "0 8px",
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 600,
    },
  },

  layout: {
    grid: {
      columns: 12,
      gutter: 20,
    },

    page: {
      paddingX: { mobile: 16, tablet: 20, desktop: 24 },
      paddingY: { mobile: 16, tablet: 20, desktop: 24 },
      maxWidth: 1200,
    },

    section: {
      gap: 20,
    },
  },

  principles: [
    "Clarity - Text is legible, icons are precise, adornments are subtle",
    "Deference - Fluid motion and crisp, beautiful interface help people understand and interact with content",
    "Depth - Distinct visual layers and realistic motion convey hierarchy",
  ],

  customVariables: {
    "apple-blur-effect": "blur(20px)",
    "apple-vibrancy": "saturate(180%)",
  },
};
