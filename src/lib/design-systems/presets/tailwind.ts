/**
 * Tailwind Design System Preset
 * ==============================
 * Based on Tailwind CSS v3 default configuration
 * https://tailwindcss.com/
 *
 * Philosophy:
 * - Utility-first
 * - Flexible and customizable
 * - Modern and clean
 * - Developer-friendly
 */

import { DesignSystem } from "../design-system-framework";

export const TAILWIND_SYSTEM: DesignSystem = {
  id: "tailwind",
  name: "Tailwind Modern",
  description: "Modern utility-first design system based on Tailwind CSS",
  author: "Tailwind Labs",
  version: "3.0",

  colors: {
    light: {
      primary: "#3B82F6", // Blue-500
      primaryHover: "#2563EB", // Blue-600
      primaryActive: "#1D4ED8", // Blue-700
      primaryDisabled: "#D1D5DB", // Gray-300

      success: "#10B981", // Green-500
      successHover: "#059669", // Green-600
      warning: "#F59E0B", // Amber-500
      warningHover: "#D97706", // Amber-600
      error: "#EF4444", // Red-500
      errorHover: "#DC2626", // Red-600
      info: "#06B6D4", // Cyan-500
      infoHover: "#0891B2", // Cyan-600

      text: "#111827", // Gray-900
      textSecondary: "#6B7280", // Gray-500
      textDisabled: "#9CA3AF", // Gray-400
      background: "#FFFFFF",
      backgroundSecondary: "#F9FAFB", // Gray-50
      border: "#E5E7EB", // Gray-200
      borderHover: "#3B82F6",
      divider: "#E5E7EB",

      surface: "#FFFFFF",
      surfaceHover: "#F9FAFB",
      surfaceActive: "#F3F4F6", // Gray-100
    },

    dark: {
      primary: "#60A5FA", // Blue-400
      primaryHover: "#3B82F6", // Blue-500
      primaryActive: "#2563EB", // Blue-600
      primaryDisabled: "#374151", // Gray-700

      success: "#34D399", // Green-400
      successHover: "#10B981", // Green-500
      warning: "#FBBF24", // Amber-400
      warningHover: "#F59E0B", // Amber-500
      error: "#F87171", // Red-400
      errorHover: "#EF4444", // Red-500
      info: "#22D3EE", // Cyan-400
      infoHover: "#06B6D4", // Cyan-500

      text: "#F9FAFB", // Gray-50
      textSecondary: "#9CA3AF", // Gray-400
      textDisabled: "#6B7280", // Gray-500
      background: "#111827", // Gray-900
      backgroundSecondary: "#1F2937", // Gray-800
      border: "#374151", // Gray-700
      borderHover: "#60A5FA",
      divider: "#374151",

      surface: "#1F2937",
      surfaceHover: "#374151",
      surfaceActive: "#4B5563", // Gray-600
    },
  },

  typography: {
    fontFamily:
      "var(--font-outfit), 'Outfit', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyMono: "ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Consolas, monospace",

    sizes: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      "2xl": 24,
      "3xl": 30,
      "4xl": 36,
      "5xl": 48,
      "6xl": 60,
    },

    lineHeights: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.625,
      loose: 2,
    },

    fontWeights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900,
    },
  },

  spacing: {
    scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128],
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
      "6xl": 96,
      "7xl": 128,
    },
  },

  borderRadius: {
    scale: [0, 2, 4, 6, 8, 12, 16, 24],
    aliases: {
      none: 0,
      sm: 2,
      base: 4,
      md: 6,
      lg: 8,
      xl: 12,
      "2xl": 16,
      full: 9999,
    },
  },

  shadows: {
    none: "none",
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    base: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
  },

  animations: {
    linear: "linear",
    easeIn: "cubic-bezier(0.4, 0, 1, 1)",
    easeOut: "cubic-bezier(0, 0, 0.2, 1)",
    easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  },

  components: {
    button: {
      height: { sm: 32, base: 40, lg: 48 },
      padding: { sm: "0 12px", base: "0 16px", lg: "0 24px" },
      borderRadius: 6,
      fontSize: { sm: 14, base: 16, lg: 18 },
      fontWeight: 500,
      transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
    },

    input: {
      height: { sm: 32, base: 40, lg: 48 },
      padding: "0 12px",
      borderRadius: 6,
      borderWidth: 1,
      fontSize: 16,
    },

    card: {
      padding: { sm: 16, base: 24, lg: 32 },
      borderRadius: 8,
      shadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      border: "1px solid #E5E7EB",
    },

    table: {
      rowHeight: { compact: 40, comfortable: 52 },
      headerHeight: 52,
      cellPadding: "12px 16px",
      borderWidth: 1,
    },

    modal: {
      borderRadius: 12,
      shadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
      padding: 24,
      widths: { sm: 384, base: 512, lg: 768, xl: 1024 },
    },

    badge: {
      height: { sm: 20, base: 24 },
      padding: "0 8px",
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 500,
    },
  },

  layout: {
    grid: {
      columns: 12,
      gutter: 16,
    },

    page: {
      paddingX: { mobile: 16, tablet: 24, desktop: 32 },
      paddingY: { mobile: 16, tablet: 24, desktop: 32 },
      maxWidth: 1280,
    },

    section: {
      gap: 24,
    },
  },

  principles: [
    "Utility-first - Compose components using single-purpose utilities",
    "Constraint-based - Work within a design system, not against it",
    "Build anything - Customize everything without fighting the framework",
  ],
};
