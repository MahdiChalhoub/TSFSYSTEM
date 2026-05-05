import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Design-language guardrails.
 *
 * The full audit lives in `scripts/lint/check_design_language.mjs`
 * (run via `npm run lint:design`). These ESLint rules are the subset
 * that flags inside the editor as you type — only the patterns that
 * are simple-enough to catch via no-restricted-syntax string regex
 * with low false-positive risk.
 *
 * The audit script catches the rest (gradients on titles, oversized
 * page titles, inline <style> blocks, etc.) where context matters
 * more than a one-line regex can express.
 *
 * Why warnings (not errors) at editor level:
 *  - The codebase has 10k+ pre-existing violations to migrate over time.
 *  - Failing CI on every legacy file would block all unrelated PRs.
 *  - A warning surfaces the issue to anyone editing the file without
 *    blocking commits. Convert to error once a section is clean.
 */
const designLanguageRules = {
    'no-restricted-syntax': [
        'warn',
        {
            // Raw Tailwind palette colors. Use var(--app-*) tokens.
            selector: `Literal[value=/\\b(?:bg|text|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:[1-9]00|50|950)\\b/]`,
            message: 'Design language: use var(--app-primary) / var(--app-info, #3b82f6) / var(--app-success) etc. Raw Tailwind palette colors break the theme engine.',
        },
        {
            // Hardcoded grid columns. Use auto-fit + minmax.
            selector: `Literal[value=/\\bgrid-cols-(?:1|2|3|4|5|6|7|8|9|10|11|12)\\b/]`,
            message: 'Design language: use `style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}` — hardcoded grid-cols-N breaks responsive flow.',
        },
        {
            // Oversized page titles.
            selector: `Literal[value=/\\btext-(?:2xl|3xl|4xl|5xl|6xl)\\b/]`,
            message: 'Design language: page titles must use `text-lg md:text-xl font-black tracking-tight`. text-2xl+ is forbidden per §15.',
        },
        {
            // Legacy theme tokens.
            selector: `Literal[value=/\\b(?:theme-text(?:-muted)?|theme-bg|app-text-faint|app-text-muted)\\b/]`,
            message: 'Design language: legacy token. Use --app-foreground / --app-muted-foreground / --app-surface / --app-bg.',
        },
        {
            // Sub-9px text.
            selector: `Literal[value=/\\btext-\\[(?:[1-7])px\\]/]`,
            message: 'Design language: text under 8px is forbidden. Minimum 9px for badges, 11px for body.',
        },
        {
            // Thin font weights (unreadable on dark + light themes).
            selector: `Literal[value=/\\bfont-(?:thin|extralight|light)\\b/]`,
            message: 'Design language: font-thin/extralight/light is unreadable in dark+light themes. Minimum is font-medium.',
        },
    ],
};

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    {
        // Apply design rules everywhere except the explicit exemption list.
        files: ['src/**/*.{ts,tsx}'],
        ignores: [
            'src/storefront/themes/**',     // Themed storefronts: own design system.
            'src/app/(auth)/**',            // Full-bleed by design.
            'src/app/(public)/**',          // Same.
            'src/app/**/ui-kit/**',         // UI kit demos every variant on purpose.
            '**/_archive/**',               // Legacy archives — out of scope.
            '**/ARCHIVE/**',                // Same (uppercase variant).
            '**/legacy/**',                 // Same.
            'src/modules/mcp/_design.tsx',  // The primitives file IS the design system.
        ],
        rules: designLanguageRules,
    },
    globalIgnores([
        // Default ignores of eslint-config-next:
        '.next/**',
        'out/**',
        'build/**',
        'next-env.d.ts',
    ]),
]);

export default eslintConfig;
