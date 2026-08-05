---
tags: [ui, upload-labs, reference]
relatedNodes: []
createdAt: 2026-08-05T15:40:00.000Z
---

# Upload Labs-style tech-tree/pipeline UI patterns

Reference findings, human-facing only (`tags: [reference]`,
`relatedNodes: []` — no automated node acts on this file; see below).

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
implements this pattern. `core/` (the whole dashboard included) is
hand-authored and off-limits to the loop per `README.md` —
`build`/`test` may only touch `generated/**` and `state/**`, so no cycle can
ever edit `graph-render.ts`. This file is descriptive reference for a
*human* who decides to extend the dashboard themselves, not a target for an
automated cycle — hence `relatedNodes: []` (convention documented in
`build-readiness-brief.md`, not repeated here).
