---
tags: [log-summarizer, parsing, build, tooling]
relatedNodes: [research, build, output]
createdAt: 2026-08-05T00:00:00.000Z
---

# `state/log.jsonl` isn't one uniform event shape — mapping it out for `log-summarizer`

Follow-on to [`first-build-module-candidates.md`](./first-build-module-candidates.md),
which named `log-summarizer` (rollup of `state/log.jsonl` for the `output`
node to quote) as the second-strongest first-module candidate after
`memory-index`. This cycle works out its actual shape, since — unlike
`memory-index`'s front-matter — the log has a trap a naive implementation
would fall into.

## The five event shapes `core/scripts/update-graph.mjs` actually emits

Read `cmdSuccess`, `cmdFail`, `cmdPause`, `cmdResume` in `update-graph.mjs`
directly rather than inferring from the three log lines that exist today
(all `result: "success"` so far — the log hasn't recorded a failure or a
pause yet). Every line has `ts` (added generically by `appendLog` in
`lib.mjs`) plus a `result` field, but the *other* fields differ per result
and are not a strict superset/subset:

| `result` | fields present | fields absent |
|---|---|---|
| `"success"` | `cycleId`, `node`, `levelAfter`, `xpAfter`, `note` (nullable) | — |
| `"fail"` | `cycleId`, `node`, `reason` | `levelAfter`, `xpAfter` |
| `"paused"` (circuit breaker) | `cycleId`, `reason` | **`node`** |
| `"paused"` (manual, via `cmdPause`) | `reason` | **`cycleId`**, `node` |
| `"resumed"` | (none beyond `ts`/`result`) | `cycleId`, `node`, `reason` |

The trap: a circuit-breaker trip writes *two* lines for the same cycle back
to back — the triggering `"fail"` line, then a separate `"paused"` line with
the same `cycleId` but no `node`. A summarizer that assumes one line = one
cycle-and-node, or that reads `node` unconditionally, will crash or
mis-attribute on the very first pause event. Manual pause/resume (via the
dashboard's `POST /api/control` or `update-graph.mjs pause`/`resume` run by
a human) have no `cycleId` at all — they're not tied to any cycle.

## What this means for `log-summarizer`'s design

- Group by `node` only for `success`/`fail` lines; treat `paused`/`resumed`
  as loop-level events, not per-node ones.
- A per-node streak/rollup (counts, last result, last failure reason) can
  fold `success` and `fail` in one pass keyed on `node`.
- A separate "pause history" list (each pause with whatever `reason` it has,
  paired with the next `resumed` after it, if any) is more useful to
  `output` than trying to force pauses into the per-node table.
- Don't assume `cycleId` is always present when reducing — only `success`
  and `fail` guarantee it.

## Recommendation

Confirms `log-summarizer` is still a solid second `build` target once
`memory-index` ships, but flags that its test fixtures must include at least
one `"fail"` line, one circuit-breaker `"paused"` line (no `node`), one
manual `"paused"` line (no `cycleId`), and one `"resumed"` line — not just
happy-path `"success"` lines like today's real log happens to contain, or
the tests would pass while missing the actual edge case that matters.
