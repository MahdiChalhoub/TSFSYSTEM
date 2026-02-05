# Documentation: Project Cleanup Workflow

## Goal of the Workflow
The goal of this workflow is to ensure the repository remains clean and manageable by moving deprecated or unnecessary code to a designated read-only history folder (`/ARCHIVE`).

## Target Files
Any file or directory in the project that is no longer used, has been replaced by a more stable version, or was part of a failed experiment.

## Step-by-Step Workflow
1. **Discovery**: Check the codebase for unused components, old backend logic, or redundant documentation.
2. **Impact Assessment**: Use search tools to find all references/imports of the target files.
3. **Execution**: 
   - Create corresponding parent directories in `/ARCHIVE`.
   - Move the files (e.g., `git mv` or standard move).
4. **Cleanup**: Scan the project for broken imports and remove them.
5. **Validation**: Run build scripts.

## How it achieves its goal
By enforcing a "Move instead of Delete" policy, we preserve the project's history while keeping the active `src` and `erp_backend` directories lean and logically consistent.
