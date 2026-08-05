---
tags: [actionable, plan, build, memory-index]
relatedNodes: [plan, build]
createdAt: 2026-08-05T16:24:43.000Z
---

# Plan: what `build` should tackle first

First `plan` cycle. Read the whole graph (`state/graph.json`), the full
`state/log.jsonl` (10 entries, cycle-1 through cycle-10 — all `research` or
`memory`, all successes, no failures/pauses yet), and both current
`state/memory/*.md` files.

## Where the graph stands

`research` L1 (50/50xp), `memory` L1 (50/50xp), `plan` L0 (this cycle takes
it to 10xp). `build` is still locked — needs `memory` L2 *and* `plan` L1,
so roughly 4 more successful `memory` cycles and 4 more successful `plan`
cycles before it opens up (at 10xp/success, 50xp/level). No urgency to
finalize every implementation detail now; this file exists so whichever
`plan` cycle *is* running when `build` finally unlocks doesn't start cold.

## What `build` should do first: scaffold `memory-index`

`state/memory/build-readiness-brief.md` already did the real design work
(recommendation + rejected alternatives + a worked-out dependency-free
front-matter-parsing algorithm) — this plan just points at it rather than
re-deriving it. Concretely, the first `build` cycle should:

1. `node core/scripts/new-module.mjs memory-index --desc "Parses state/memory/*.md front-matter into a structured index"`
2. Replace the scaffolded `src/index.mjs` placeholder with the 4-step parser
   from `build-readiness-brief.md`'s "`memory-index` design" section:
   split on the `---` delimiters, split each line on the first `:`,
   bracket-strip+split for array values, plain string otherwise, throw
   loudly if the delimiters are missing.
3. Add a directory-scan wrapper that maps the parser over
   `state/memory/*.md` and returns `{file, tags, relatedNodes, createdAt}[]`.
4. Leave the scaffolded `test/index.test.mjs` for the `test` node to fill in
   — `build`'s job is implementation, not test coverage (see `CYCLE.md`'s
   node table: `test` is a separate step for a reason).

Don't chase `log-summarizer` first even though it's also ready to build —
`build-readiness-brief.md`'s ranking (memory-index first, cited gap is more
concrete) still holds and nothing since has changed it.

## One open risk worth flagging to whoever runs that `build` cycle

`build-readiness-brief.md`'s architecture note says `generated/` modules
aren't wired into `core/` at all — so "done" for this module means
`npm test` passing under `generated/memory-index`, not any integration
step. Don't let a `build` cycle scope-creep into trying to wire it into the
dashboard; there's deliberately no surface for that.
