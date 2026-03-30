---
phase: quick
plan: 260330-whn
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/App.css
  - client/src/hooks/useTheme.ts
  - client/src/components/ThemeToggle.tsx
  - client/src/App.tsx
  - client/index.html
autonomous: true
requirements: [dark-mode-toggle]

must_haves:
  truths:
    - "App renders in dark mode by default on first visit"
    - "User can toggle between dark and light mode"
    - "Theme preference persists across page refreshes via localStorage"
    - "Toggle button visible in header next to refresh context"
  artifacts:
    - path: "client/src/hooks/useTheme.ts"
      provides: "Theme state management with localStorage persistence"
    - path: "client/src/components/ThemeToggle.tsx"
      provides: "Moon/Sun icon toggle button"
    - path: "client/src/App.css"
      provides: "Tailwind 4 dark variant override for class-based control"
    - path: "client/index.html"
      provides: "Inline script to prevent flash of wrong theme"
  key_links:
    - from: "client/src/hooks/useTheme.ts"
      to: "document.documentElement.classList"
      via: "useEffect toggling .dark class on <html>"
      pattern: "classList\\.(add|remove|toggle)"
    - from: "client/src/App.tsx"
      to: "client/src/components/ThemeToggle.tsx"
      via: "ThemeToggle rendered in header"
      pattern: "<ThemeToggle"
---

<objective>
Add dark/light theme toggle to Claude Directory Tree.

Purpose: Let users switch between dark and light themes. Dark by default, persisted in localStorage.
Output: useTheme hook, ThemeToggle button in header, class-based Tailwind dark mode.
</objective>

<execution_context>
@/Users/furqantariq/.claude/get-shit-done/workflows/execute-plan.md
@/Users/furqantariq/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@client/src/App.css
@client/src/App.tsx
@client/src/components/tree/TreeToolbar.tsx
@client/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enable class-based dark mode and prevent flash</name>
  <files>client/src/App.css, client/index.html</files>
  <action>
1. In App.css, add the Tailwind 4 custom variant override BEFORE the @theme block:
   ```
   @custom-variant dark (&:where(.dark, .dark *));
   ```
   This switches Tailwind's `dark:` variant from prefers-color-scheme to class-based.

2. Remove the `@media (prefers-color-scheme: dark)` block (lines 71-93) from App.css. The `.dark` class block (lines 49-69) already handles dark mode. The media query becomes redundant with class-based control and would cause conflicts.

3. In client/index.html, add an inline script in `<head>` BEFORE any stylesheets to prevent flash of light theme on load:
   ```html
   <script>
     (function(){var t=localStorage.getItem('theme');if(t==='light')return;document.documentElement.classList.add('dark')})()
   </script>
   ```
   Logic: If stored theme is 'light', do nothing (light is CSS default). Otherwise (dark or no preference), add .dark class immediately. This runs before paint, preventing flash.
  </action>
  <verify>
    <automated>cd "/Users/furqantariq/Documents/Projects/Claude Directory Tree" && grep -q "@custom-variant dark" client/src/App.css && grep -q "classList.add" client/index.html && ! grep -q "prefers-color-scheme" client/src/App.css && echo "PASS"</automated>
  </verify>
  <done>Tailwind dark: variant uses class strategy; prefers-color-scheme media query removed; index.html has inline script that applies .dark before first paint</done>
</task>

<task type="auto">
  <name>Task 2: Create useTheme hook and ThemeToggle component, wire into header</name>
  <files>client/src/hooks/useTheme.ts, client/src/components/ThemeToggle.tsx, client/src/App.tsx</files>
  <action>
1. Create `client/src/hooks/useTheme.ts`:
   - Export type `Theme = 'dark' | 'light'`
   - Export `useTheme()` hook returning `{ theme: Theme, toggleTheme: () => void }`
   - Initialize state from localStorage key 'theme', default to 'dark' if absent
   - `toggleTheme` flips dark<->light
   - useEffect syncs to DOM: add/remove 'dark' class on `document.documentElement`, write to localStorage key 'theme'
   - Read localStorage in useState initializer (same pattern used for view toggle per project decisions)

2. Create `client/src/components/ThemeToggle.tsx`:
   - Import `Moon`, `Sun` from 'lucide-react'
   - Import `Button` from '@/components/ui/button'
   - Import `useTheme` from '@/hooks/useTheme'
   - Render a ghost icon Button (same style as refresh button in TreeToolbar)
   - Show Moon icon when theme is 'dark', Sun icon when 'light'
   - onClick calls toggleTheme
   - aria-label: "Switch to light mode" / "Switch to dark mode" based on current theme
   - Icon size={16} to match RefreshCw in toolbar

3. Update `client/src/App.tsx`:
   - Import ThemeToggle from '@/components/ThemeToggle'
   - In the header element, add ThemeToggle next to the h1. Use a flex container:
     ```tsx
     <header className="px-6 pt-6 pb-2 shrink-0 flex items-center justify-between">
       <h1 className="text-xl font-semibold text-foreground">Claude Directory Tree</h1>
       <ThemeToggle />
     </header>
     ```
   - This places the toggle in the top-right of the header, visually aligned with the toolbar row below.
  </action>
  <verify>
    <automated>cd "/Users/furqantariq/Documents/Projects/Claude Directory Tree" && npx tsc --noEmit 2>&1 | tail -5</automated>
  </verify>
  <done>ThemeToggle button renders in header showing Moon/Sun icon; clicking toggles dark/light class on html element; preference persists in localStorage across refreshes</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `npm run build` completes successfully
3. Manual: Open app, verify dark theme by default, click toggle to switch to light, refresh page, verify light persists
</verification>

<success_criteria>
- App loads in dark mode by default (no flash of light)
- Moon/Sun toggle button visible in header top-right
- Clicking toggle switches between dark and light themes
- Theme persists in localStorage across page refreshes
- All existing dark: variant styles continue working correctly
</success_criteria>

<output>
After completion, create `.planning/quick/260330-whn-dark-mode-theme-toggle/260330-whn-SUMMARY.md`
</output>
