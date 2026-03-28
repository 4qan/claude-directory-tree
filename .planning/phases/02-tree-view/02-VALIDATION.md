---
phase: 2
slug: tree-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

**Note:** Current vitest config sets `environment: 'node'`. Component tests require DOM environment. Wave 0 must add `happy-dom` and configure environment per test file pattern.

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/deriveVisibleTree.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | TREE-01 | unit | `npm test -- tests/deriveVisibleTree.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | TREE-02 | unit | `npm test -- tests/iconMap.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 0 | TREE-03 | component | `npm test -- tests/ArtifactTree.test.tsx` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 0 | TREE-04 | component | `npm test -- tests/ArtifactTree.test.tsx` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 0 | TREE-05 | unit | `npm test -- tests/deriveVisibleTree.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-06 | 01 | 0 | TREE-06 | component | `npm test -- tests/ArtifactTree.test.tsx` | ❌ W0 | ⬜ pending |
| 02-01-07 | 01 | 0 | TREE-07 | unit | `npm test -- tests/deriveVisibleTree.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-08 | 01 | 0 | TREE-08 | unit | `npm test -- tests/deriveVisibleTree.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/deriveVisibleTree.test.ts` — stubs for TREE-01, TREE-05, TREE-07, TREE-08
- [ ] `tests/iconMap.test.ts` — stubs for TREE-02
- [ ] `tests/ArtifactTree.test.tsx` — stubs for TREE-03, TREE-04, TREE-06 (requires DOM env)
- [ ] `happy-dom` devDependency — DOM environment for component tests
- [ ] `vitest.config.ts` update — environment: 'happy-dom' for `*.tsx` test files

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual tree expand/collapse animation | TREE-01 | CSS transition smoothness not automatable | Open app, expand/collapse scope nodes, verify smooth animation |
| Icon visual correctness | TREE-02 | SVG rendering fidelity | Open app, verify each artifact type shows correct Lucide icon |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
