# Deferred Items - Phase 04

## Pre-existing Issue: Static asset path mismatch for npm distribution

**Discovered during:** Plan 04-01 Task 2

**Issue:** `src/server/static.ts` resolves client assets at `join(__dirname, '../client/dist')`. When bundled to `dist/server/index.js`, this path resolves to `<install_root>/dist/client/dist`. However, Vite builds the client to `client/dist/` at repo root, and the `files` field in `package.json` only includes `dist/`. This means the client SPA won't be served correctly when the package is installed via npm.

**Impact:** `npx claude-directory-tree` will start the server but won't serve the client UI.

**Resolution needed:** Either:
1. Change Vite `build.outDir` from `client/dist` to `dist/client/dist` (or `dist/public`), OR
2. Update static.ts to resolve path differently for bundled vs development use

**Belongs in:** Plan 04-02 or a quick patch before npm publish
