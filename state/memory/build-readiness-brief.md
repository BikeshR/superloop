---
tags: [actionable, build, planning, memory-index, log-summarizer, architecture]
relatedNodes: [research, memory, plan, build]
createdAt: 2026-08-05T00:00:00.000Z
---

# Build readiness brief: what `plan`/`build` need for the first `generated/` module

Consolidates four separate research-cycle notes (cycle-2 through cycle-5)
into one file — they were really one throughline ("what should the first
build module be, and what does it need to know") spread across four
appends. Distilled and replaces: `first-build-module-candidates.md`,
`memory-frontmatter-parsing.md`, `log-jsonl-event-shapes.md`,
`generated-modules-are-standalone.md` (all removed by this curation pass;
their content lives here now, condensed).

Tagged `actionable` (cycle-7 curation) — a small vocabulary this corpus is
starting to use so a skim can tell, from front-matter alone, which files a
`plan`/`build` cycle should read closely (`actionable`) versus which are
background context only (`reference`, see `upload-labs-ui-patterns.md`).
Future `memory` cycles should keep applying one or the other as the corpus
grows, rather than leaving new files untagged either way.

## Recommendation: `memory-index` first, `log-summarizer` second

`generated/` is still empty. Three candidates were weighed:

1. **`memory-index`** (recommended) — parses front-matter across
   `state/memory/*.md` into `{file, tags, relatedNodes, createdAt}[]`. Fixes
   a real, cited gap: `CYCLE.md` tells every cycle to skim front-matter to
   orient, but nothing does that parsing programmatically today. Small,
   dependency-free, easy to test, low guardrail risk.
2. **`log-summarizer`** — rolls up `state/log.jsonl` (success/fail counts
   per node, streaks, last failure) for the `output` node to quote. Also a
   real need, slightly less novel than `memory-index` since `control.json`
   already tracks some of the same signals (`consecutiveFailures`,
   `lastCycleId`).
3. **`graph-lint`** (rejected) — a stricter `graph.json` validator.
   `core/scripts/lib.mjs` already has `assertGraphShape`; duplicating
   validation logic in `generated/` (meant to be the loop's *product*, not a
   second copy of its own safety rails) is a weak fit.

Whichever `plan` cycle runs next should build on this rather than
re-evaluating from scratch.

## `memory-index` design: dependency-free front-matter parser

Both existing memory files (and `CYCLE.md`'s own template) use one
consistent, narrow grammar — no nested maps, no multiline scalars, no quoted
strings:

```
---
tags: [tag-one, tag-two]
relatedNodes: [research, memory]
createdAt: 2026-08-05T12:00:00.000Z
---
```

`core/scripts/lib.mjs` is explicit that `core/` tooling stays
dependency-free ("no zod, no glob libs") so it runs with nothing but `node`
— the same reasoning applies here; a real YAML parser would be way more
dependency than this three-key, flow-sequence-only grammar needs. A ~15-line
hand-rolled parser covers it:

1. Split the file on `\n`, find the two `---` delimiter lines, slice between
   them.
2. For each line, split on the first `:`.
3. If the trimmed value starts with `[` and ends with `]`, strip the
   brackets and split on `,`, trimming each item (empty string → `[]`).
4. Otherwise keep the trimmed value as a plain string (`createdAt` needs no
   further parsing — ISO strings sort and `Date()`-parse fine as strings).

Should still validate loudly if the two `---` delimiters aren't found at
all, so a genuinely broken file surfaces rather than being silently skipped.
Implement as a pure function
(`parseFrontMatter(content) -> {tags, relatedNodes, createdAt, body}`) plus a
directory-scan wrapper over `state/memory/*.md`. Test fixtures: a
well-formed file (any current memory file works as-is), an empty-array case
(`tags: []`), and a missing-delimiter case to confirm the loud-failure path.

## `log-summarizer` design: `log.jsonl`'s non-uniform event shapes

Reading `cmdSuccess`/`cmdFail`/`cmdPause`/`cmdResume` in `update-graph.mjs`
directly (not just today's log, which only has `"success"` lines so far)
shows the log is **five event shapes, not one** — trap for a naive
implementation:

| `result` | fields present | fields absent |
|---|---|---|
| `"success"` | `cycleId`, `node`, `levelAfter`, `xpAfter`, `note` (nullable) | — |
| `"fail"` | `cycleId`, `node`, `reason` | `levelAfter`, `xpAfter` |
| `"paused"` (circuit breaker) | `cycleId`, `reason` | **`node`** |
| `"paused"` (manual) | `reason` | **`cycleId`**, `node` |
| `"resumed"` | (none beyond `ts`/`result`) | `cycleId`, `node`, `reason` |

A circuit-breaker trip writes *two* lines for one cycle (`"fail"` then
`"paused"`, same `cycleId`, no `node` on the second). Manual pause/resume
(dashboard or CLI) have no `cycleId` at all. Design implications:

- Group by `node` only for `success`/`fail`; treat `paused`/`resumed` as
  loop-level events, not per-node ones.
- Build a separate "pause history" list (each pause's `reason`, paired with
  the next `resumed` if any) rather than forcing pauses into the per-node
  table.
- Don't assume `cycleId` is always present when reducing.
- Test fixtures must include at least one of each of the five shapes above,
  not just happy-path `"success"` lines — the real log so far only has
  those, so tests copying today's log verbatim would miss the actual edge
  case that matters.

## Architecture constraint: `generated/` modules are standalone

Checked whether anything in `core/` actually consumes a `generated/`
module once built: nothing does, and nothing can — `core/web/server`
reads `state/*` directly with its own duplicated JSON/JSONL readers (by
deliberate design, per that file's own comments), and `core/` is
off-limits to the loop per `README.md`, so no future cycle can wire a
module into the dashboard even if it wanted to.

This means "shipping" a module is exactly what `CYCLE.md`'s `ship` row
says and no more — a successful merge, nothing else. Don't treat "is
anything calling this?" as a blocker; there is deliberately no integration
surface inside `core/` for `build` to reach. The bar is: the module is
correct and independently `npm test`-passing.
