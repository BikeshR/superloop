---
tags: [ui, upload-labs, reference]
relatedNodes: [research, build]
createdAt: 2026-08-05T15:40:00.000Z
---

# Upload Labs-style tech-tree/pipeline UI patterns

Findings for the `build`/dashboard nodes to draw on later:

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
implements this pattern; future `build`/`output` cycles extending the UI
should keep new visuals consistent with it rather than introducing a second
style.
