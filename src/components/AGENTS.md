# Components Instructions

## Scope

This folder owns reusable UI components and feature components.

## Design Rules

- Read `C:\synapse\.agents\skills\synapse-design\SKILL.md` before changing component UI, spacing, colors, typography, or interaction states.
- Use existing shadcn/ui wrappers from `src/components/ui` and customize through project tokens rather than default shadcn styling.
- Keep workspace UI dense, calm, and operational. Avoid marketing sections, nested cards, decorative backgrounds, and oversized headings in app surfaces.
- Use lucide icons for icon buttons where a matching icon exists.
- Ensure text fits on mobile and desktop and does not overlap adjacent controls.

## Engineering Rules

- Keep server-only data access out of client components.
- Components that call API routes must handle loading, empty, success, and error states.
- Do not duplicate MIME limits, model defaults, or persistence rules in components when shared constants or API responses are available.

