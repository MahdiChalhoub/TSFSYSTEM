# ADR-0005: Repo Hygiene Policy

## Status

ACCEPTED

## Context

TSFSYSTEM grew from a startup prototype to a 200+ page ERP system. During rapid development, the repo accumulated: 262 root files (should be ~15), 94 backend root files, 875MB of tracked deadweight (SQL dumps, media, legacy archives, debug logs), and fragmented documentation across 3 roots. This made onboarding hard, reviews noisy, and CI slow.

## Decision

**Enforce strict repo hygiene as a product, not a one-time cleanup.**

### Root structure rules
- Root file count ≤ 20 (tracked)
- Backend root file count ≤ 15 (tracked)
- No file > 10MB without explicit approval
- No `.env`, `.sqlite3`, `.sql`, media tracked in git

### Directory taxonomy
| Directory | Purpose | Status |
|-----------|---------|--------|
| `src/` | Frontend source of truth | Active |
| `erp_backend/apps/` | Backend source of truth | Active |
| `erp_backend/kernel/` | ConnectorEngine + events | Active |
| `docs/` | Canonical documentation root | Active |
| `docs/decisions/` | ADRs | Active |
| `tools/` | Operational scripts | Active |
| `scripts/ci/` | CI/CD automation | Active |
| `_quarantine/` | Under review for deletion | Legacy |

### Enforcement
- Pre-commit hook: `.github/hooks/pre-commit`
- CI hygiene check: `scripts/ci/check-repo-hygiene.sh`
- Architecture fitness: `scripts/ci/check-architecture-fitness.sh`
- CODEOWNERS: `.github/CODEOWNERS`

### History policy
- Large files must be removed from git history, not just .gitignored
- Use `git-filter-repo` for purges
- All team members re-clone after force push

## Consequences

### Positive
- Onboarding: new contributors see a clean, professional repo
- Reviews: less noise, clear ownership
- CI: faster checkout, smaller clone
- Audit: clear source-of-truth classification

### Negative
- Requires discipline to maintain
- Force pushes after history purges disrupt clones
- Some flexibility lost (can't just dump scripts at root)

## References

- Pre-commit hook: `.github/hooks/pre-commit`
- Hygiene check: `scripts/ci/check-repo-hygiene.sh`
- Fitness check: `scripts/ci/check-architecture-fitness.sh`
- CODEOWNERS: `.github/CODEOWNERS`
- Purge script: `scripts/ci/purge-history.sh`
