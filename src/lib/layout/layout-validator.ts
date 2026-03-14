/**
 * TSF Layout Validator
 * ====================
 * Scores and validates pages against the TSF Layout Standard.
 *
 * Every page gets a score out of 100 based on:
 * - Hierarchy clarity (20 points)
 * - Spacing consistency (15 points)
 * - Grid alignment (15 points)
 * - Action clarity (15 points)
 * - Scanability (10 points)
 * - Responsiveness (10 points)
 * - Component consistency (10 points)
 * - Workflow efficiency (5 points)
 */

import {
  TSF_LAYOUT_STANDARD,
  TSF_STRUCTURAL_RULES,
  TSF_COMPONENT_RULES,
  TSF_UX_RULES,
  isValidSpacing,
  isValidBorderRadius,
} from "./layout-standards";
import {
  LayoutArchetype,
  LayoutZone,
  LAYOUT_ARCHETYPES,
  validateArchetypeUsage,
} from "./layout-archetypes";

// ============================================================================
// TYPES
// ============================================================================

export interface PageLayout {
  archetype: LayoutArchetype;
  zones: LayoutZone[];
  spacing: number[];
  borderRadii: number[];
  gridColumns: number[];
  primaryActions: number;
  secondaryActions: number;
  destructiveActions: number;
  nestingDepth: number;
  hasHeader: boolean;
  hasFiltersAboveResults: boolean;
  hasKPIsBeforeData: boolean;
  hasStickyActions: boolean;
  hasEmptyStates: boolean;
  hasLoadingStates: boolean;
  mobileOptimized: boolean;
  tabletOptimized: boolean;
}

export interface ValidationScore {
  total: number; // Out of 100
  breakdown: {
    hierarchy: number; // Out of 20
    spacing: number; // Out of 15
    grid: number; // Out of 15
    actions: number; // Out of 15
    scanability: number; // Out of 10
    responsiveness: number; // Out of 10
    consistency: number; // Out of 10
    workflow: number; // Out of 5
  };
  problems: string[];
  suggestions: string[];
  grade: "A" | "B" | "C" | "D" | "F";
}

// ============================================================================
// VALIDATOR
// ============================================================================

export class LayoutValidator {
  /**
   * Score a page layout against TSF standards
   */
  static validate(layout: PageLayout): ValidationScore {
    const problems: string[] = [];
    const suggestions: string[] = [];

    // 1. Hierarchy (20 points)
    const hierarchyScore = this.scoreHierarchy(layout, problems, suggestions);

    // 2. Spacing (15 points)
    const spacingScore = this.scoreSpacing(layout, problems, suggestions);

    // 3. Grid (15 points)
    const gridScore = this.scoreGrid(layout, problems, suggestions);

    // 4. Actions (15 points)
    const actionsScore = this.scoreActions(layout, problems, suggestions);

    // 5. Scanability (10 points)
    const scanabilityScore = this.scoreScanability(layout, problems, suggestions);

    // 6. Responsiveness (10 points)
    const responsivenessScore = this.scoreResponsiveness(
      layout,
      problems,
      suggestions
    );

    // 7. Consistency (10 points)
    const consistencyScore = this.scoreConsistency(layout, problems, suggestions);

    // 8. Workflow (5 points)
    const workflowScore = this.scoreWorkflow(layout, problems, suggestions);

    const total =
      hierarchyScore +
      spacingScore +
      gridScore +
      actionsScore +
      scanabilityScore +
      responsivenessScore +
      consistencyScore +
      workflowScore;

    return {
      total: Math.round(total),
      breakdown: {
        hierarchy: Math.round(hierarchyScore),
        spacing: Math.round(spacingScore),
        grid: Math.round(gridScore),
        actions: Math.round(actionsScore),
        scanability: Math.round(scanabilityScore),
        responsiveness: Math.round(responsivenessScore),
        consistency: Math.round(consistencyScore),
        workflow: Math.round(workflowScore),
      },
      problems,
      suggestions,
      grade: this.getGrade(total),
    };
  }

  // ── Hierarchy Scoring (20 points) ──
  private static scoreHierarchy(
    layout: PageLayout,
    problems: string[],
    suggestions: string[]
  ): number {
    let score = 20;

    // Page header required (-5 points)
    if (!layout.hasHeader) {
      score -= 5;
      problems.push("Missing PageHeader - every page must have a header");
    }

    // Validate archetype zones (-5 points)
    const validation = validateArchetypeUsage(layout.archetype, layout.zones);
    if (!validation.valid) {
      score -= 5;
      if (validation.missing.length > 0) {
        problems.push(
          `Missing required zones: ${validation.missing.join(", ")}`
        );
      }
      if (validation.extra.length > 0) {
        problems.push(`Unexpected zones: ${validation.extra.join(", ")}`);
      }
    }

    // Nesting depth check (-5 points)
    if (layout.nestingDepth > 3) {
      score -= 5;
      problems.push(
        `Too deep nesting (${layout.nestingDepth} levels) - max 3 allowed`
      );
      suggestions.push("Flatten component hierarchy");
    }

    // Filters placement (-5 points)
    if (
      layout.zones.includes("filter-toolbar") &&
      !layout.hasFiltersAboveResults
    ) {
      score -= 5;
      problems.push("Filters must appear ABOVE results, not mixed");
    }

    // KPIs placement (-2 points deduction if wrong)
    if (layout.zones.includes("kpi-strip") && !layout.hasKPIsBeforeData) {
      score -= 2;
      problems.push("KPIs should appear BEFORE detailed records");
    }

    return Math.max(0, score);
  }

  // ── Spacing Scoring (15 points) ──
  private static scoreSpacing(
    layout: PageLayout,
    problems: string[],
    suggestions: string[]
  ): number {
    let score = 15;

    // Check all spacing values (-3 points per invalid)
    const invalidSpacing = layout.spacing.filter((s) => !isValidSpacing(s));
    if (invalidSpacing.length > 0) {
      const deduction = Math.min(15, invalidSpacing.length * 3);
      score -= deduction;
      problems.push(
        `Invalid spacing values: ${invalidSpacing.join(", ")}px - use spacing scale`
      );
      suggestions.push(
        `Allowed spacing: ${TSF_LAYOUT_STANDARD.spacing.scale.join(", ")}px`
      );
    }

    return Math.max(0, score);
  }

  // ── Grid Scoring (15 points) ──
  private static scoreGrid(
    layout: PageLayout,
    problems: string[],
    suggestions: string[]
  ): number {
    let score = 15;

    // Check grid columns are valid (-5 points)
    const invalidColumns = layout.gridColumns.filter(
      (cols) => cols > 12 || cols < 1 || !Number.isInteger(cols)
    );
    if (invalidColumns.length > 0) {
      score -= 5;
      problems.push(
        `Invalid grid columns: ${invalidColumns.join(", ")} - use 1-12 only`
      );
    }

    // Check border radii (-5 points)
    const invalidRadii = layout.borderRadii.filter(
      (r) => !isValidBorderRadius(r)
    );
    if (invalidRadii.length > 0) {
      score -= 5;
      problems.push(
        `Invalid border radius: ${invalidRadii.join(", ")}px - use radius scale`
      );
      suggestions.push(
        `Allowed radii: ${TSF_LAYOUT_STANDARD.borderRadius.scale.join(", ")}px`
      );
    }

    return Math.max(0, score);
  }

  // ── Actions Scoring (15 points) ──
  private static scoreActions(
    layout: PageLayout,
    problems: string[],
    suggestions: string[]
  ): number {
    let score = 15;

    // Too many primary actions (-7 points)
    if (layout.primaryActions > 2) {
      score -= 7;
      problems.push(
        `Too many primary actions (${layout.primaryActions}) - max 2 per section`
      );
      suggestions.push("Convert less important actions to secondary style");
    }

    // Destructive actions should be secondary (-5 points)
    if (layout.destructiveActions > 0 && layout.primaryActions > 1) {
      score -= 5;
      problems.push("Destructive actions should never be primary-styled");
    }

    // Sticky actions missing for forms (-3 points)
    if (layout.archetype === "form-workflow" && !layout.hasStickyActions) {
      score -= 3;
      suggestions.push("Forms should have sticky action footer");
    }

    return Math.max(0, score);
  }

  // ── Scanability Scoring (10 points) ──
  private static scoreScanability(
    layout: PageLayout,
    problems: string[],
    suggestions: string[]
  ): number {
    let score = 10;

    // Empty states missing (-5 points)
    if (!layout.hasEmptyStates) {
      score -= 5;
      problems.push("Missing empty states - add illustrations and next actions");
    }

    // Loading states missing (-5 points)
    if (!layout.hasLoadingStates) {
      score -= 5;
      problems.push("Missing loading states - add skeletons or spinners");
    }

    return Math.max(0, score);
  }

  // ── Responsiveness Scoring (10 points) ──
  private static scoreResponsiveness(
    layout: PageLayout,
    problems: string[],
    suggestions: string[]
  ): number {
    let score = 10;

    // Mobile optimization (-5 points)
    if (!layout.mobileOptimized) {
      score -= 5;
      problems.push("Not optimized for mobile");
      suggestions.push("Stack components vertically on mobile");
    }

    // Tablet optimization (-5 points)
    if (!layout.tabletOptimized) {
      score -= 5;
      problems.push("Not optimized for tablet");
    }

    return Math.max(0, score);
  }

  // ── Consistency Scoring (10 points) ──
  private static scoreConsistency(
    layout: PageLayout,
    problems: string[],
    suggestions: string[]
  ): number {
    let score = 10;

    // Check archetype consistency
    const archetype = LAYOUT_ARCHETYPES[layout.archetype];
    if (!archetype) {
      score -= 10;
      problems.push("Unknown layout archetype");
      return 0;
    }

    // Deduct for zone mismatches (already checked in hierarchy)
    // This section is for component-level consistency

    return Math.max(0, score);
  }

  // ── Workflow Efficiency Scoring (5 points) ──
  private static scoreWorkflow(
    layout: PageLayout,
    problems: string[],
    suggestions: string[]
  ): number {
    let score = 5;

    // Data workspace should have detail view
    if (
      layout.archetype === "data-workspace" &&
      !layout.zones.includes("detail-drawer") &&
      !layout.zones.includes("detail-modal")
    ) {
      score -= 2;
      suggestions.push("Add detail drawer for quick record inspection");
    }

    // Forms should have breadcrumbs or cancel action
    if (layout.archetype === "form-workflow") {
      // Can add more workflow checks here
    }

    return Math.max(0, score);
  }

  // ── Grade Calculation ──
  private static getGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Quick validation - pass/fail only
 */
export function isLayoutValid(layout: PageLayout): boolean {
  const score = LayoutValidator.validate(layout);
  return score.total >= 70; // Must score C or higher
}

/**
 * Get validation report as string
 */
export function getValidationReport(layout: PageLayout): string {
  const score = LayoutValidator.validate(layout);

  let report = `\n`;
  report += `═══════════════════════════════════════════════\n`;
  report += `  TSF LAYOUT VALIDATION REPORT\n`;
  report += `═══════════════════════════════════════════════\n\n`;
  report += `Archetype: ${layout.archetype}\n`;
  report += `Total Score: ${score.total}/100 (Grade: ${score.grade})\n\n`;

  report += `Breakdown:\n`;
  report += `  Hierarchy:      ${score.breakdown.hierarchy}/20\n`;
  report += `  Spacing:        ${score.breakdown.spacing}/15\n`;
  report += `  Grid:           ${score.breakdown.grid}/15\n`;
  report += `  Actions:        ${score.breakdown.actions}/15\n`;
  report += `  Scanability:    ${score.breakdown.scanability}/10\n`;
  report += `  Responsiveness: ${score.breakdown.responsiveness}/10\n`;
  report += `  Consistency:    ${score.breakdown.consistency}/10\n`;
  report += `  Workflow:       ${score.breakdown.workflow}/5\n\n`;

  if (score.problems.length > 0) {
    report += `Problems Found:\n`;
    score.problems.forEach((p, i) => {
      report += `  ${i + 1}. ${p}\n`;
    });
    report += `\n`;
  }

  if (score.suggestions.length > 0) {
    report += `Suggestions:\n`;
    score.suggestions.forEach((s, i) => {
      report += `  ${i + 1}. ${s}\n`;
    });
    report += `\n`;
  }

  report += `═══════════════════════════════════════════════\n`;

  return report;
}
