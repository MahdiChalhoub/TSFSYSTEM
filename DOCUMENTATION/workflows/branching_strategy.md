# Branching and Update Workflow

This document outlines the standard workflow for managing updates across the TSF Dajingo platform using the split branching strategy.

## Goal
To maintain a clean, logic-less "Blanc Engine" while allowing for modular updates to both the kernel and feature modules.

## Architecture
The platform is split into three main branch categories:

1. **Baseline (`engine-stable`)**: Pure infrastructure.
2. **Infrastructure Updates (`update-core`)**: Staging for Kernel ZIPs.
3. **Module Updates (`update-modules`)**: Staging for Feature ZIPs.

## Workflow Steps

### 1. Core Platform Refinement
- All core infrastructure changes are committed to `engine-stable`.
- A semantic version is generated for the core (e.g., v1.1.0).
- The `KernelManager` tracks these baseline versions.

### 2. Preparing a Kernel Update
- Switch to `update-core`.
- Merge latest `engine-stable`.
- Add platform-wide enhancements.
- Generate `update-core.zip` from this branch.

### 3. Preparing a Module Update
- Switch to `update-modules`.
- Implement or update the feature module (e.g., `finance`).
- Ensure the module is contained within its `apps/[name]` and `saas/[name]` folders.
- Generate `update-module.zip` from this branch.

## Data Movement
- **Read**: Update logic reads from `update.json` in the root.
- **Save**: Updates are written to the filesystem via `KernelManager` / `ModuleManager` extraction logic.

## Integrity Rules
- No domain logic in `engine-stable`.
- All modules must build against the `engine-stable` baseline.
