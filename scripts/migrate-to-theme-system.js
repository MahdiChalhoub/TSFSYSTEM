#!/usr/bin/env node

/**
 * Migration Script: Convert Hardcoded Styles to Theme/Layout Variables
 *
 * This script scans your codebase and converts hardcoded colors and spacing
 * to use the new theme/layout CSS variables.
 *
 * Usage:
 *   node scripts/migrate-to-theme-system.js [options]
 *
 * Options:
 *   --dry-run       Show what would be changed without actually changing
 *   --path <path>   Only process files in this directory
 *   --file <file>   Only process this specific file
 *   --backup        Create .backup files before modifying
 */

const fs = require('fs');
const path = require('path');

// Color mappings to theme variables
const COLOR_MAPPINGS = {
  // Backgrounds
  '#020617': 'var(--theme-bg)',
  '#0F172A': 'var(--theme-surface)',
  'rgb(2, 6, 23)': 'var(--theme-bg)',
  'rgb(15, 23, 42)': 'var(--theme-surface)',

  // Text colors
  '#F1F5F9': 'var(--theme-text)',
  '#94A3B8': 'var(--theme-text-muted)',
  '#CBD5E1': 'var(--theme-text)',
  'rgb(241, 245, 249)': 'var(--theme-text)',
  'rgb(148, 163, 184)': 'var(--theme-text-muted)',

  // Primary colors
  '#10B981': 'var(--theme-primary)',
  '#059669': 'var(--theme-primary-dark)',
  'rgb(16, 185, 129)': 'var(--theme-primary)',

  // Borders
  'rgba(255, 255, 255, 0.08)': 'var(--theme-border)',
  'rgba(255, 255, 255, 0.1)': 'var(--theme-border)',
};

// Spacing mappings to layout variables
const SPACING_MAPPINGS = {
  // Padding patterns
  'padding: 1rem': 'padding: var(--layout-card-padding)',
  'padding: 1.5rem': 'padding: var(--layout-card-padding)',
  'padding: 2rem': 'padding: var(--layout-container-padding)',
  'padding: 3rem': 'padding: var(--layout-container-padding)',
  'p-4': 'p-[var(--layout-card-padding)]',
  'p-6': 'p-[var(--layout-container-padding)]',

  // Gap patterns
  'gap: 1rem': 'gap: var(--layout-element-gap)',
  'gap: 1.5rem': 'gap: var(--layout-section-spacing)',
  'gap: 2rem': 'gap: var(--layout-section-spacing)',
  'gap-4': 'gap-[var(--layout-element-gap)]',
  'gap-6': 'gap-[var(--layout-section-spacing)]',

  // Border radius
  'rounded-lg': 'rounded-[var(--layout-card-radius)]',
  'rounded-xl': 'rounded-[var(--layout-card-radius)]',
  'borderRadius: 0.5rem': 'borderRadius: var(--layout-card-radius)',
  'borderRadius: 0.75rem': 'borderRadius: var(--layout-card-radius)',
};

// Tailwind class mappings
const TAILWIND_MAPPINGS = {
  'bg-slate-900': 'bg-[var(--theme-bg)]',
  'bg-slate-800': 'bg-[var(--theme-surface)]',
  'text-slate-100': 'text-[var(--theme-text)]',
  'text-slate-400': 'text-[var(--theme-text-muted)]',
  'text-emerald-500': 'text-[var(--theme-primary)]',
  'border-slate-700': 'border-[var(--theme-border)]',
};

class ThemeMigrator {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.backup = options.backup || false;
    this.stats = {
      filesProcessed: 0,
      filesModified: 0,
      colorsReplaced: 0,
      spacingReplaced: 0,
      tailwindReplaced: 0,
    };
  }

  processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      let modified = content;
      let hasChanges = false;

      // Replace color values
      for (const [oldColor, newVar] of Object.entries(COLOR_MAPPINGS)) {
        const regex = new RegExp(oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const matches = (modified.match(regex) || []).length;
        if (matches > 0) {
          modified = modified.replace(regex, newVar);
          this.stats.colorsReplaced += matches;
          hasChanges = true;
        }
      }

      // Replace spacing values
      for (const [oldSpacing, newVar] of Object.entries(SPACING_MAPPINGS)) {
        const regex = new RegExp(oldSpacing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const matches = (modified.match(regex) || []).length;
        if (matches > 0) {
          modified = modified.replace(regex, newVar);
          this.stats.spacingReplaced += matches;
          hasChanges = true;
        }
      }

      // Replace Tailwind classes
      for (const [oldClass, newClass] of Object.entries(TAILWIND_MAPPINGS)) {
        const regex = new RegExp(`\\b${oldClass}\\b`, 'g');
        const matches = (modified.match(regex) || []).length;
        if (matches > 0) {
          modified = modified.replace(regex, newClass);
          this.stats.tailwindReplaced += matches;
          hasChanges = true;
        }
      }

      this.stats.filesProcessed++;

      if (hasChanges) {
        this.stats.filesModified++;

        if (!this.dryRun) {
          // Create backup if requested
          if (this.backup) {
            fs.writeFileSync(`${filePath}.backup`, content, 'utf8');
          }

          // Write modified content
          fs.writeFileSync(filePath, modified, 'utf8');
          console.log(`✅ Modified: ${filePath}`);
        } else {
          console.log(`🔍 Would modify: ${filePath}`);
        }
      }

      return hasChanges;
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
      return false;
    }
  }

  processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip node_modules, .git, etc.
        if (!file.startsWith('.') && file !== 'node_modules') {
          this.processDirectory(filePath);
        }
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        this.processFile(filePath);
      }
    }
  }

  printStats() {
    console.log('\n📊 Migration Statistics:');
    console.log(`  Files processed: ${this.stats.filesProcessed}`);
    console.log(`  Files modified: ${this.stats.filesModified}`);
    console.log(`  Colors replaced: ${this.stats.colorsReplaced}`);
    console.log(`  Spacing replaced: ${this.stats.spacingReplaced}`);
    console.log(`  Tailwind classes replaced: ${this.stats.tailwindReplaced}`);

    if (this.dryRun) {
      console.log('\n⚠️  DRY RUN - No files were actually modified');
      console.log('   Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Migration complete!');
    }
  }
}

// CLI
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  backup: args.includes('--backup'),
  path: args.includes('--path') ? args[args.indexOf('--path') + 1] : null,
  file: args.includes('--file') ? args[args.indexOf('--file') + 1] : null,
};

const migrator = new ThemeMigrator(options);

console.log('🚀 Starting Theme/Layout System Migration...\n');

if (options.file) {
  // Process single file
  migrator.processFile(options.file);
} else if (options.path) {
  // Process specific directory
  migrator.processDirectory(options.path);
} else {
  // Process entire src directory
  const srcPath = path.join(__dirname, '..', 'src');
  migrator.processDirectory(srcPath);
}

migrator.printStats();
