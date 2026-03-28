# Deferred Items - Phase 02

## Out-of-scope issues discovered during execution

### server.test.ts EADDRINUSE flakiness
- **Discovered during:** Plan 02-02 Task 2
- **Issue:** `tests/server.test.ts > INFRA-03` intermittently fails with EADDRINUSE (port 3737 in use) — likely a test cleanup race condition. Pre-existing before Plan 02-02.
- **Impact:** Does not affect build or new component tests. Skipped stubs run cleanly.
- **Action needed:** Investigate port cleanup in server.test.ts afterEach/afterAll hooks.
