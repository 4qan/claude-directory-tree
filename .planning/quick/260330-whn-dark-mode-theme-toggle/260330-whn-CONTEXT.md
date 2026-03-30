# Quick Task 260330-whn: Dark mode theme toggle - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Task Boundary

Add dark mode support with a theme toggle to Claude Directory Tree.

</domain>

<decisions>
## Implementation Decisions

### Default Theme
- Dark by default. User can switch to light or system manually.
- Persist preference in localStorage.

### Toggle Placement
- Icon button (Moon/Sun) in the header bar, top right, next to the refresh button.
- Single click cycles: dark -> light -> system (or just dark/light toggle).
- Standard pattern used by GitHub, VS Code, Vercel.

### Claude's Discretion
- Tailwind dark: strategy (class-based for manual control)
- Color palette choices for dark mode
- Whether to support 3-way (dark/light/system) or just 2-way (dark/light) toggle

</decisions>

<specifics>
## Specific Ideas

No specific requirements beyond standard dark mode implementation with Tailwind dark: variants.

</specifics>
