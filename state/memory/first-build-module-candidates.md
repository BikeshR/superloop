---
tags: [build, planning, tooling, memory]
relatedNodes: [research, plan, build]
createdAt: 2026-08-05T00:00:00.000Z
---

# What should the first `generated/` module be?

Open question going into this cycle: `generated/` is still empty (only
`.gitkeep`), and once `memory` and `plan` level up enough to unlock `build`,
that node needs a concrete first target rather than guessing cold. This is
that groundwork.

## What already exists in `core/scripts/`

Read through `lib.mjs`, `new-module.mjs`, `check-guardrails.mjs`, and
`update-graph.mjs` to map what's already handled vs. genuinely missing:

- JSON read/write, log append, graph shape validation, unlock recomputation,
  arg parsing, and the state-commit-and-push helper all live in `lib.mjs`.
- Module scaffolding (`new-module.mjs`) and guardrail diff-checking are
  covered.
- **Nothing parses the YAML front-matter of `state/memory/*.md` files.**
  `CYCLE.md` step 1 tells every cycle to "skim `state/memory/*.md` ...
  the file front-matter (`tags:`, `relatedNodes:`) tells you what's in each
  one without opening every file" — but today that's manual (a human or
  agent eyeballing `head` output), not tooling. There is exactly one memory
  file today (`upload-labs-ui-patterns.md`), so the gap hasn't hurt yet, but
  it will as the corpus grows, and it directly serves both the `memory`
  node (curation) and the `plan` node (skimming before deciding what's
  next).

## Candidate first modules, weighed

1. **`memory-index`** — parses front-matter across `state/memory/*.md` and
   emits a `{file, tags, relatedNodes, createdAt}[]` index (as a function,
   not a file-writer, to stay a pure library `build` can extend later).
   - Pro: directly matches a real, cited gap in the loop's own instructions.
   - Pro: trivially testable (fixture `.md` strings in, structured objects
     out) — a clean fit for the `test` node right after.
   - Pro: small, dependency-free, low risk of tripping the guardrail diff
     size limit.
   - Con: only useful once the memory corpus is bigger than one file.

2. **`log-summarizer`** — reads `state/log.jsonl` and produces a rollup
   (success/fail counts per node, streaks, last failure reason) for the
   `output` node to quote instead of re-deriving by hand each time.
   - Pro: also a real, cited need (`output` node writes a human-readable
     shipped-summary each cycle).
   - Con: overlaps somewhat with what `update-graph.mjs` already tracks in
     `control.json` (consecutiveFailures, lastCycleId) — less novel.

3. **`graph-lint`** — a stricter validator than `assertGraphShape` (e.g.
   checks every `dependsOn.id` actually exists as a node, no cycles in the
   dependency edges beyond the intentional `output → memory` feedback edge).
   - Pro: reinforces safety, which fits the project's "guardrails everywhere"
     ethos.
   - Con: `core/` already partially covers this via `assertGraphShape`;
     duplicating validation logic in `generated/` (which is meant to be the
     loop's *product*, not a second copy of its safety rails) is a weaker
     fit for what `build` is for.

## Recommendation

**`memory-index`** is the strongest first candidate: it's the most clearly
evidenced gap (cited directly in `CYCLE.md`'s own orientation step), it's
small enough to scaffold and implement in one `build` cycle without
guardrail risk, and it gives the very next `test` cycle an easy, meaningful
target. `log-summarizer` is a solid second choice if `memory-index` turns
out to be done already by the time `build` unlocks. Whichever `plan` cycle
runs next should read this file and pick one rather than starting from a
blank page.
