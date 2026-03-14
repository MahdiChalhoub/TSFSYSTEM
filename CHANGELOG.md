# Changelog

All notable changes to TSFSYSTEM will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **ADR System** — Architecture Decision Records at `docs/decisions/` (ADR-0001 through ADR-0005)
- **Health endpoints** — `/health/`, `/health/db/`, `/health/full/` for monitoring
- **Request tracing** — Correlation IDs (`X-Request-ID`) and structured JSON logging
- **CODEOWNERS** — Path-based review routing for all critical paths
- **Architecture fitness tests** — 10 automated checks for module boundaries, posting rules, and hygiene
- **Pre-commit hook** — Blocks files >10MB, `.env`, `.sql`, `.sqlite3`, forbidden paths
- **CI hygiene check** — `scripts/ci/check-repo-hygiene.sh`

### Changed
- **`.gitignore`** — Rewritten with targeted enterprise rules (155 rules)
- **`README.md`** — Enterprise README with monorepo map, quick start, module law, hygiene rules
- **Root structure** — 262 → 16 tracked files
- **Backend structure** — 94 → 11 tracked files
- **Documentation** — Consolidated to single `docs/` root

### Removed
- `tsf-docs/` — Vercel scaffold (not real documentation)
- `ARCHIVE/`, `restored/`, `_inventory_mode_src/`, `.backups/` — Purged from git history
- `DOCUMENTATION/` — Moved to `docs/`
- 109 session/status markdown files from root
- 67 ad-hoc scripts from root → `tools/`
- SQL dump (361MB), media (371MB) — Purged from git history

### Fixed
- **JSX parent element error** in purchase order detail page
- **Git pack size** — 395.72 → 348.77 MiB after history purge

## [Previous Releases]

> Historical changes were not tracked in changelog format.
> See `git log` for full commit history.
