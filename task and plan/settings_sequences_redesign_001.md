# Settings: Sequences Page Redesign — Plan #001

## Goal
Redesign `/settings/sequences` for readability, usability, and code quality compliance.

## Changes
1. Split 400-line monolith into 5 files (all ≤ 226 lines)
2. Added column headers (Entity, Tier, Prefix, Next #, Pad, Suffix, Preview)
3. Replaced 24 individual save buttons with single "Save All Changes" batch action
4. Added dirty-row tracking with yellow left-border indicator
5. Increased text from 7-10px to 11-12px for readability
6. Live preview chip per row updates on every keystroke
7. Wired SettingsPageShell's Ctrl+S to batch save

## Files
- `page.tsx` — 226 lines (was 400)
- `_lib/types.ts` — 35 lines (NEW)
- `_lib/constants.ts` — 55 lines (NEW)
- `_components/SequenceRow.tsx` — 110 lines (NEW)
- `_components/SequenceTable.tsx` — 143 lines (NEW)

## Status
✅ DONE — typecheck clean (0 errors)
