---
phase: 3
slug: operations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/operations.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/operations.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | OPS-01 | unit (server inject) | `npx vitest run tests/operations.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | OPS-02 | unit (RTL) | `npx vitest run tests/ContextMenu.test.tsx` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | OPS-03 | unit (RTL) | `npx vitest run tests/ArtifactTree.test.tsx` | ✅ Extend | ⬜ pending |
| 03-01-04 | 01 | 0 | OPS-04 | unit (server inject + fs) | `npx vitest run tests/operations.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 0 | OPS-05 | unit (server inject + fs) | `npx vitest run tests/operations.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 0 | OPS-06 | unit (server inject + fs) | `npx vitest run tests/operations.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-07 | 01 | 0 | OPS-07 | unit (server inject + fs) | `npx vitest run tests/operations.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-08 | 01 | 0 | OPS-08 | unit (server inject) | `npx vitest run tests/operations.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-09 | 01 | 0 | OPS-09 | unit (spy on fs) | `npx vitest run tests/operations.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 0 | SUMM-01 | unit (RTL) | `npx vitest run tests/ArtifactDetailPanel.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/operations.test.ts` — stubs for OPS-01 through OPS-09 (server route tests using Fastify inject + temp dir fixtures)
- [ ] `tests/ContextMenu.test.tsx` — covers OPS-02 (context menu rendering + menu items per node type)
- [ ] `tests/ArtifactDetailPanel.test.tsx` — covers SUMM-01 (panel shows name, type, description)
- [ ] Extend `tests/ArtifactTree.test.tsx` — add selection state and keyboard navigation tests for OPS-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| System editor opens on click | OPS-01 | OS-level process launch cannot be verified in unit test | Click artifact row, verify editor window appears |
| Right-click context menu position | OPS-02 | Menu positioning relative to cursor requires visual check | Right-click artifact, verify menu appears at cursor |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
