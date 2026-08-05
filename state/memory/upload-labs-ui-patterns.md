---
tags: [ui, upload-labs, reference]
relatedNodes: [research]
createdAt: 2026-08-05T15:40:00.000Z
---

# Upload Labs-style tech-tree/pipeline UI patterns

Reference findings, human-facing only — see correction below.

- Node tiles show label, level, and an xp-fill bar; locked nodes render
  dashed/dim rather than hidden, so the shape of what's still ahead is
  visible even before it unlocks.
- Pipeline edges read left-to-right in dependency order; any feedback edge
  (a later stage feeding an earlier one) is drawn as a curved arc below the
  main row instead of crossing other wires.
- Recent activity is best shown as a transient pulse on the node/edge that
  just fired, layered on top of the static graph, rather than a full
  re-layout every tick.

This superloop dashboard (`core/web/client/src/graph-render.ts`) already
implements this pattern.

**Correction (cycle-6 curation):** the original note here said future
`build`/`output` cycles would extend this UI. That's wrong — per
`README.md`, `core/` (which includes the whole dashboard) is hand-authored
and off-limits to the loop; `build`/`test` may only touch `generated/**` and
`state/**`. No cycle can ever edit `graph-render.ts`. This file stays only
as descriptive reference for a *human* who decides to extend the dashboard
themselves, not as a target for an automated cycle.
