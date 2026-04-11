/**
 * TSF Layout Standard v1
 * =====================
 * The single source of truth for layout governance.
 *
 * This is NOT about colors or themes.
 * This is about FORCING every screen to obey one layout language.
 *
 * Every page, component, and agent MUST respect these rules.
 */

// ============================================================================
// A. FOUNDATIONS
// ============================================================================

export const TSF_LAYOUT_STANDARD = {
  version: "1.0.0",
  name: "TSF Layout Standard v1",

  // ── Grid System ──
  grid: {
    columns: 12,
    gutter: 16,
    containerMaxWidths: {
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      "2xl": 1536,
      full: "100%",
    },
  },

  // ── Spacing Scale (px) ──
  // ONLY these values allowed. No arbitrary spacing.
  spacing: {
    scale: [0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128],
    aliases: {
      none: 0,
      xs: 4,
      sm: 8,
      md: 12,
      base: 16,
      lg: 24,
      xl: 32,
      "2xl": 48,
      "3xl": 64,
      "4xl": 96,
      "5xl": 128,
    },
  },

  // ── Border Radius Scale (px) ──
  borderRadius: {
    scale: [0, 4, 8, 12, 16, 24],
    aliases: {
      none: 0,
      sm: 4,
      base: 8,
      md: 12,
      lg: 16,
      xl: 24,
      full: 9999,
    },
  },

  // ── Shadow Scale ──
  shadows: {
    none: "none",
    sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
    base: "0 1px 3px rgba(0, 0, 0, 0.1)",
    md: "0 4px 6px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
    xl: "0 20px 25px rgba(0, 0, 0, 0.1)",
    "2xl": "0 25px 50px rgba(0, 0, 0, 0.25)",
  },

  // ── Breakpoints ──
  breakpoints: {
    mobile: { min: 0, max: 767 },
    tablet: { min: 768, max: 1023 },
    desktop: { min: 1024, max: Infinity },
  },

  // ── Page Structure ──
  page: {
    paddingX: {
      mobile: 16,
      tablet: 24,
      desktop: 32,
    },
    paddingY: {
      mobile: 16,
      tablet: 20,
      desktop: 24,
    },
    sectionGap: 24,
    contentMaxWidth: 1536,
  },

  // ── Typography Scale ──
  typography: {
    fontSizes: {
      xs: 10,
      sm: 12,
      base: 14,
      lg: 16,
      xl: 18,
      "2xl": 20,
      "3xl": 24,
      "4xl": 28,
      "5xl": 32,
      "6xl": 40,
    },
    lineHeights: {
      none: 1,
      tight: 1.25,
      snug: 1.375,
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
} as const;

// ============================================================================
// B. STRUCTURAL RULES
// ============================================================================

export const TSF_STRUCTURAL_RULES = {
  // ── Every Page MUST Have ──
  page: {
    required: [
      "PageHeader",      // Title, breadcrumbs, description
      "PrimaryActions",  // Main action buttons
      "ContentZone",     // Main content area
    ],
    forbidden: [
      "RandomCardStart", // No page can start with cards without header
      "DeepNesting",     // Max 3 levels of visual containers
      "ArbitrarySpacing", // Must use spacing scale
    ],
  },

  // ── Data-Heavy Pages MUST Use ──
  dataWorkspace: {
    required: [
      "FiltersBar",      // Filter controls
      "SummaryStrip",    // KPIs or record count
      "MainDataView",    // Table, grid, or list
    ],
    optional: [
      "DetailDrawer",    // Side panel for details
      "DetailModal",     // Modal for quick edits
    ],
    rules: [
      "Filters must appear ABOVE results, never mixed inside",
      "KPIs must appear BEFORE detailed records",
      "Primary action (Create) always top-right",
    ],
  },

  // ── Forms MUST Follow ──
  forms: {
    layout: {
      mobile: "1-column",
      tablet: "2-column",
      desktop: "2-column (3-column if fields are short)",
    },
    rules: [
      "Group related fields into sections",
      "Required fields marked clearly",
      "Primary action bottom-right or sticky footer",
      "Destructive actions secondary-styled",
      "Long forms use stepper or tabs",
    ],
  },

  // ── Dashboards MUST Follow ──
  dashboard: {
    structure: [
      "PageHeader",
      "KPIRow",         // Metric cards
      "ChartsRow",      // Visualizations
      "RecentActivity", // Tables or lists
    ],
    rules: [
      "KPIs use consistent card size",
      "Max 6 KPIs in top row",
      "Charts use 6 or 12-column widths",
      "No nested scrolling",
    ],
  },

  // ── Detail Pages MUST Follow ──
  detailRecord: {
    structure: [
      "SummaryHero",    // Key info prominently
      "TabNavigation",  // Organize related data
      "TabContent",     // Details, history, related
      "ActionFooter",   // Contextual actions
    ],
    rules: [
      "Summary hero shows critical fields only",
      "Use tabs when >3 logical sections",
      "Related records in separate tab",
      "Activity timeline shows latest first",
    ],
  },
} as const;

// ============================================================================
// C. COMPONENT RULES
// ============================================================================

export const TSF_COMPONENT_RULES = {
  // ── Buttons ──
  buttons: {
    priorities: ["primary", "secondary", "ghost"],
    rules: [
      "Max 1 primary button per screen section",
      "Destructive actions use secondary + red color",
      "Icon-only buttons for repeated actions in lists",
    ],
    sizes: {
      sm: { height: 32, paddingX: 12, fontSize: 12 },
      base: { height: 40, paddingX: 16, fontSize: 14 },
      lg: { height: 48, paddingX: 24, fontSize: 16 },
    },
  },

  // ── Cards ──
  cards: {
    padding: [16, 24], // Only 2 variants
    borderRadius: 12,
    rules: [
      "KPI cards: 16px padding",
      "Content cards: 24px padding",
      "No card-in-card-in-card (max 2 levels)",
    ],
  },

  // ── Tables ──
  tables: {
    rowHeight: {
      comfortable: 48,
      compact: 40,
    },
    rules: [
      "Toolbar required for data-heavy tables",
      "Row actions aligned right",
      "Sticky header for >20 rows",
      "Zebra striping optional",
    ],
  },

  // ── Modals ──
  modals: {
    widths: {
      sm: 400,
      base: 600,
      lg: 800,
      xl: 1000,
      full: "90vw",
    },
    rules: [
      "Use drawer for detail views",
      "Use modal for quick actions",
      "Max 1 modal open at a time",
      "Footer always sticky",
    ],
  },

  // ── Badges ──
  badges: {
    sizes: {
      sm: { height: 20, paddingX: 8, fontSize: 10 },
      base: { height: 24, paddingX: 12, fontSize: 12 },
    },
    statusTaxonomy: [
      "draft",
      "pending",
      "active",
      "completed",
      "cancelled",
      "error",
    ],
    rules: [
      "Use same status names across all modules",
      "Status color follows system palette",
    ],
  },

  // ── Side Panels ──
  sidePanels: {
    widths: {
      sm: 320,
      base: 480,
      lg: 640,
    },
    rules: [
      "Detail drawers: base (480px)",
      "Filter panels: sm (320px)",
      "Form wizards: lg (640px)",
    ],
  },
} as const;

// ============================================================================
// D. UX RULES
// ============================================================================

export const TSF_UX_RULES = {
  actionPlacement: [
    "Primary action always top-right of section",
    "Destructive action never primary-colored",
    "Bulk actions in toolbar, not scattered",
    "Contextual actions near affected content",
  ],

  contentHierarchy: [
    "Filters above results, not mixed",
    "KPIs before detailed records",
    "Summary before details",
    "Actions before or after content, never inline",
  ],

  workflowPatterns: [
    "Multi-step workflows show progress stepper",
    "Long forms use sections or tabs",
    "Unsaved changes prompt before navigation",
    "Success messages appear near action trigger",
  ],

  emptyStates: [
    "Must include illustration or icon",
    "Must explain why empty",
    "Must include next action (Create, Import, etc.)",
    "Never show empty table without message",
  ],

  loading: [
    "Use skeleton loading for content areas",
    "Use spinner for actions/operations",
    "Preserve layout during loading",
    "Show progress for long operations",
  ],

  responsiveness: [
    "Mobile: stack everything vertically",
    "Tablet: 2-column forms, side-by-side views",
    "Desktop: full layout power",
    "Never horizontal scroll on mobile",
  ],
} as const;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export type SpacingToken = keyof typeof TSF_LAYOUT_STANDARD.spacing.aliases;
export type BorderRadiusToken = keyof typeof TSF_LAYOUT_STANDARD.borderRadius.aliases;
export type ShadowToken = keyof typeof TSF_LAYOUT_STANDARD.shadows;
export type FontSizeToken = keyof typeof TSF_LAYOUT_STANDARD.typography.fontSizes;

export function isValidSpacing(value: number): boolean {
  return (TSF_LAYOUT_STANDARD.spacing.scale as unknown as number[]).includes(value);
}

export function isValidBorderRadius(value: number): boolean {
  return (TSF_LAYOUT_STANDARD.borderRadius.scale as unknown as number[]).includes(value);
}

export function getSpacing(token: SpacingToken): number {
  return TSF_LAYOUT_STANDARD.spacing.aliases[token];
}

export function getBorderRadius(token: BorderRadiusToken): number {
  return TSF_LAYOUT_STANDARD.borderRadius.aliases[token];
}
