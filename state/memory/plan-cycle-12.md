---
tags: [actionable, plan, build, log-summarizer]
relatedNodes: [plan, build]
createdAt: 2026-08-05T16:26:08.000Z
---

# Plan: queue up `log-summarizer` behind `memory-index`

Second `plan` cycle. Reread the whole graph and the full `log.jsonl` tail
first — nothing changed since `plan-cycle-11.md`: no `build`/`research`
activity happened in between (only `plan` itself advanced, L0 10xp → this
cycle's xp), so `memory-index` is still the correct first `build` target and
that plan still stands as written. Repeating it here would be noise, so this
cycle extends the roadmap instead: `plan-cycle-11.md` only detailed
scaffolding steps for `memory-index`, leaving `log-summarizer` (the
research-confirmed second candidate) as design-only. Spelling out its steps
too now means `build` has a two-module queue ready, not just one, once it
unlocks.

## `log-summarizer`: concrete steps for whichever `build` cycle gets to it

Do this **after** `memory-index` ships (per `plan-cycle-11.md`'s ordering —
unchanged). `build-readiness-brief.md`'s "`log-summarizer` design" section
already has the hard part (the 5 non-uniform `log.jsonl` event shapes and
the trap they set); this just turns that into scaffolding steps:

1. `node core/scripts/new-module.mjs log-summarizer --desc "Rolls up state/log.jsonl into per-node and pause-history summaries"`
2. Implement a pure function `summarize(entries) -> { perNode, pauseHistory }`:
   - `perNode`: group `"success"`/`"fail"` entries by `node`, produce
     `{node, successes, failures, lastResult, lastReason}` — reuse the
     grouping rule already written up (don't key `"paused"`/`"resumed"` by
     `node`, since circuit-breaker pauses don't carry one).
   - `pauseHistory`: walk entries in order, pairing each `"paused"` with the
     next `"resumed"` (if any) that follows it, keeping the `reason`.
3. Add a thin wrapper that reads `state/log.jsonl` (same parse-each-line,
   skip-malformed approach `core/web/server/src/state.ts`'s `readLog`
   already uses — reuse that reasoning, not that file, since `core/` is
   off-limits) and calls `summarize`.
4. Leave test-writing to the `test` node.

## Reminder for whoever runs `build` next

Still true, still worth repeating once more since it's easy to scope-creep
on: no `generated/` module needs to be wired into `core/` to count as done.
`npm test` passing under the module's own `package.json` is the bar.
