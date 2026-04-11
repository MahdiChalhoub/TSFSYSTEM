/**
 * TSF Layout Archetypes
 * =====================
 * Named, reusable layout patterns for enterprise screens.
 *
 * Instead of inventing layouts, agents choose the correct archetype.
 *
 * Each archetype defines:
 * - When to use it
 * - Required zones
 * - Optional zones
 * - Component mapping
 * - Responsive behavior
 */

export type LayoutArchetype =
  | "dashboard"
  | "data-workspace"
  | "form-workflow"
  | "detail-record"
  | "operational-workspace";

export type LayoutZone =
  | "page-header"
  | "breadcrumbs"
  | "kpi-strip"
  | "filter-toolbar"
  | "summary-strip"
  | "main-data-grid"
  | "main-data-list"
  | "main-form"
  | "detail-drawer"
  | "detail-modal"
  | "stepper"
  | "tab-navigation"
  | "tab-content"
  | "summary-hero"
  | "activity-timeline"
  | "related-records"
  | "action-footer"
  | "status-strip"
  | "decision-grid"
  | "side-inspector"
  | "charts-row"
  | "recent-activity";

export interface LayoutArchetypeDefinition {
  id: LayoutArchetype;
  name: string;
  description: string;
  useWhen: string[];
  zones: {
    required: LayoutZone[];
    optional: LayoutZone[];
  };
  structure: {
    header: boolean;
    sidebar?: "left" | "right" | "none";
    footer?: "sticky" | "static" | "none";
    scroll: "page" | "content-zone" | "split";
  };
  responsive: {
    mobile: string;
    tablet: string;
    desktop: string;
  };
  examples: string[];
}

// ============================================================================
// ARCHETYPE 1: DASHBOARD
// ============================================================================

export const DASHBOARD_ARCHETYPE: LayoutArchetypeDefinition = {
  id: "dashboard",
  name: "Dashboard Layout",
  description: "Overview pages with KPIs, charts, and recent activity",

  useWhen: [
    "Executive summaries",
    "Analytics pages",
    "Module home screens",
    "Real-time monitoring",
  ],

  zones: {
    required: ["page-header", "kpi-strip"],
    optional: ["charts-row", "recent-activity", "filter-toolbar"],
  },

  structure: {
    header: true,
    sidebar: "none",
    footer: "none",
    scroll: "page",
  },

  responsive: {
    mobile: "Stack all zones vertically, 1 KPI per row",
    tablet: "2 KPIs per row, charts full-width",
    desktop: "Up to 4 KPIs per row, charts in 6/12-column grid",
  },

  examples: [
    "Finance Dashboard",
    "Sales Analytics",
    "Inventory Overview",
    "CRM Homepage",
  ],
};

// ============================================================================
// ARCHETYPE 2: DATA WORKSPACE
// ============================================================================

export const DATA_WORKSPACE_ARCHETYPE: LayoutArchetypeDefinition = {
  id: "data-workspace",
  name: "Data Workspace Layout",
  description: "List/table view with filters, actions, and detail panel",

  useWhen: [
    "Customer lists (CRM)",
    "Product catalogs (Inventory)",
    "Invoice lists (Finance)",
    "Purchase orders (Procurement)",
    "Any CRUD list view",
  ],

  zones: {
    required: ["page-header", "filter-toolbar", "main-data-grid"],
    optional: ["summary-strip", "detail-drawer", "detail-modal"],
  },

  structure: {
    header: true,
    sidebar: "right", // Detail drawer
    footer: "none",
    scroll: "content-zone",
  },

  responsive: {
    mobile: "Filters collapse to dropdown, table becomes cards, no drawer",
    tablet: "Filters sidebar, table full-width, drawer overlays",
    desktop: "Filters toolbar, table + drawer split view",
  },

  examples: [
    "Customer List",
    "Product Catalog",
    "Invoice List",
    "Supplier Directory",
    "Warehouse Stock View",
  ],
};

// ============================================================================
// ARCHETYPE 3: FORM WORKFLOW
// ============================================================================

export const FORM_WORKFLOW_ARCHETYPE: LayoutArchetypeDefinition = {
  id: "form-workflow",
  name: "Form Workflow Layout",
  description: "Create/edit forms with sections, stepper, sticky actions",

  useWhen: [
    "Create new record",
    "Edit existing record",
    "Onboarding wizard",
    "Setup configuration",
    "Multi-step submission",
  ],

  zones: {
    required: ["page-header", "main-form", "action-footer"],
    optional: ["stepper", "breadcrumbs"],
  },

  structure: {
    header: true,
    sidebar: "none",
    footer: "sticky",
    scroll: "content-zone",
  },

  responsive: {
    mobile: "1-column form, sticky footer",
    tablet: "2-column form where appropriate",
    desktop: "2-3 column form for short fields",
  },

  examples: [
    "Create Invoice",
    "New Customer Form",
    "Product Entry",
    "Employee Onboarding",
    "Fiscal Year Setup",
  ],
};

// ============================================================================
// ARCHETYPE 4: DETAIL RECORD
// ============================================================================

export const DETAIL_RECORD_ARCHETYPE: LayoutArchetypeDefinition = {
  id: "detail-record",
  name: "Detail Record Layout",
  description: "Single record view with summary, tabs, timeline, related data",

  useWhen: [
    "Customer profile",
    "Supplier profile",
    "Order detail",
    "Invoice detail",
    "Product detail",
  ],

  zones: {
    required: ["page-header", "summary-hero", "tab-navigation", "tab-content"],
    optional: ["activity-timeline", "related-records", "action-footer"],
  },

  structure: {
    header: true,
    sidebar: "none",
    footer: "static",
    scroll: "content-zone",
  },

  responsive: {
    mobile: "Summary hero full-width, tabs scrollable, content stacked",
    tablet: "Summary hero 2-column, tabs full-width",
    desktop: "Summary hero 3-column, tabs + content optimized",
  },

  examples: [
    "Customer Profile",
    "Supplier Details",
    "Order #12345",
    "Invoice View",
    "Product Details",
  ],
};

// ============================================================================
// ARCHETYPE 5: OPERATIONAL WORKSPACE
// ============================================================================

export const OPERATIONAL_WORKSPACE_ARCHETYPE: LayoutArchetypeDefinition = {
  id: "operational-workspace",
  name: "Operational Workspace Layout",
  description: "Real-time operations with status, decision grid, quick actions",

  useWhen: [
    "Warehouse receiving",
    "Dispatch management",
    "Kitchen prep (restaurant)",
    "Compliance review",
    "Live order processing",
  ],

  zones: {
    required: [
      "page-header",
      "status-strip",
      "decision-grid",
      "action-footer",
    ],
    optional: ["side-inspector", "filter-toolbar"],
  },

  structure: {
    header: true,
    sidebar: "right", // Inspector panel
    footer: "sticky",
    scroll: "split", // Grid scrolls, sidebar doesn't
  },

  responsive: {
    mobile: "Not recommended (use tablet/desktop)",
    tablet: "Status strip + grid full-width, inspector modal",
    desktop: "Full split view with sticky action footer",
  },

  examples: [
    "Receiving Workspace",
    "Dispatch Console",
    "Kitchen Order Queue",
    "Quality Control Station",
  ],
};

// ============================================================================
// ARCHETYPE REGISTRY
// ============================================================================

export const LAYOUT_ARCHETYPES: Record<
  LayoutArchetype,
  LayoutArchetypeDefinition
> = {
  dashboard: DASHBOARD_ARCHETYPE,
  "data-workspace": DATA_WORKSPACE_ARCHETYPE,
  "form-workflow": FORM_WORKFLOW_ARCHETYPE,
  "detail-record": DETAIL_RECORD_ARCHETYPE,
  "operational-workspace": OPERATIONAL_WORKSPACE_ARCHETYPE,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getArchetype(
  id: LayoutArchetype
): LayoutArchetypeDefinition | undefined {
  return LAYOUT_ARCHETYPES[id];
}

export function selectArchetype(criteria: {
  hasTable?: boolean;
  hasForm?: boolean;
  hasKPIs?: boolean;
  hasTimeline?: boolean;
  isRealtime?: boolean;
  primaryPurpose:
    | "overview"
    | "list"
    | "create"
    | "edit"
    | "view"
    | "operations";
}): LayoutArchetype {
  const { hasTable, hasForm, hasKPIs, hasTimeline, isRealtime, primaryPurpose } =
    criteria;

  // Operations workspace
  if (isRealtime || primaryPurpose === "operations") {
    return "operational-workspace";
  }

  // Dashboard
  if (hasKPIs && primaryPurpose === "overview") {
    return "dashboard";
  }

  // Data workspace
  if (hasTable && (primaryPurpose === "list" || !primaryPurpose)) {
    return "data-workspace";
  }

  // Form workflow
  if (hasForm && (primaryPurpose === "create" || primaryPurpose === "edit")) {
    return "form-workflow";
  }

  // Detail record
  if (hasTimeline || primaryPurpose === "view") {
    return "detail-record";
  }

  // Default fallback
  return "data-workspace";
}

export function validateArchetypeUsage(
  archetype: LayoutArchetype,
  zones: LayoutZone[]
): { valid: boolean; missing: LayoutZone[]; extra: LayoutZone[] } {
  const definition = getArchetype(archetype);
  if (!definition) {
    return { valid: false, missing: [], extra: [] };
  }

  const missing = definition.zones.required.filter(
    (zone) => !zones.includes(zone)
  );
  const allowed = [
    ...definition.zones.required,
    ...definition.zones.optional,
  ];
  const extra = zones.filter((zone) => !allowed.includes(zone));

  return {
    valid: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}
