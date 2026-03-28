---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via Vite ecosystem) |
| **Config file** | `vitest.config.ts` — Wave 0 gap |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | INFRA-01 | unit | `vitest run tests/cli.test.ts` | Wave 0 | ⬜ pending |
| 01-01-02 | 01 | 0 | INFRA-02 | unit | `vitest run tests/server.test.ts` | Wave 0 | ⬜ pending |
| 01-01-03 | 01 | 0 | INFRA-03 | unit | `vitest run tests/server.test.ts` | Wave 0 | ⬜ pending |
| 01-01-04 | 01 | 0 | INFRA-04 | unit | `vitest run tests/scanner.test.ts` | Wave 0 | ⬜ pending |
| 01-01-05 | 01 | 0 | SCAN-01 | unit | `vitest run tests/scanner.test.ts` | Wave 0 | ⬜ pending |
| 01-01-06 | 01 | 0 | SCAN-02 | unit | `vitest run tests/config.test.ts` | Wave 0 | ⬜ pending |
| 01-01-07 | 01 | 0 | SCAN-03 | unit | `vitest run tests/classify.test.ts` | Wave 0 | ⬜ pending |
| 01-01-08 | 01 | 0 | SCAN-04 | unit | `vitest run tests/scanner.test.ts` | Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — test framework config
- [ ] `tests/cli.test.ts` — covers INFRA-01
- [ ] `tests/server.test.ts` — covers INFRA-02, INFRA-03
- [ ] `tests/scanner.test.ts` — covers INFRA-04, SCAN-01, SCAN-04
- [ ] `tests/classify.test.ts` — covers SCAN-03
- [ ] `tests/config.test.ts` — covers SCAN-02
- [ ] `tests/fixtures/` — fixture `.claude/` directory structures for scanner tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser opens on `npx claude-directory-tree` | INFRA-01 | Requires desktop environment | Run `npx claude-directory-tree` and verify browser opens to localhost |
| Server binds only to 127.0.0.1 | INFRA-02 | Network binding verification | Run `lsof -i :PORT` and confirm only 127.0.0.1 binding |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
