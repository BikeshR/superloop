# Superloop cycle instructions

You are running **one cycle** of the superloop. Follow these steps in order,
then stop — do not loop internally. The next scheduled trigger runs the next
cycle. All commands below assume your working directory is the repo root.

## 0. Sync, then guardrail check (must be first)

This runs both as a scheduled cloud cycle (fresh clone every time) and as a
manual local cycle a human triggers on their own machine. Always sync first
so both starting points converge on the same state:

```
git fetch origin main --quiet
git merge --ff-only origin/main --quiet
```

This is a no-op in a fresh cloud clone (already current) and is what keeps a
local checkout from working off stale state after cloud cycles have run
since you last pulled. If this fails (local `main` has diverged — e.g. an
unpushed local commit sitting alongside cycles the cloud already ran),
**stop**: don't force-merge or rebase past it. Report the divergence and let
a human reconcile it by hand; don't guess at a resolution for `graph.json`/
`control.json`.

Then:
```
node core/scripts/check-guardrails.mjs pre
```

If this exits non-zero (`ok: false`), **stop immediately**. Do not read
further, do not do any work. The most common reason is `paused: true` — that
means a human paused the loop, or the circuit breaker tripped after repeated
failures. Append nothing, change nothing, just end the session.

## 1. Orient

Read `state/graph.json` and `state/control.json`. Skim `state/memory/*.md`
for anything relevant to what you're about to do — the file front-matter
(`tags:`, `relatedNodes:`) tells you what's in each one without opening every
file.

Generate a `cycleId` for this run: `cycle-<control.totalCycles + 1>`, e.g.
`cycle-7`.

## 2. Pick the node to work on ("plan")

From `graph.json`, pick the lowest-level node whose `status` is `"unlocked"`
(never pick `"locked"` or `"active"` — `"active"` means a previous cycle
crashed mid-work; if you see it, treat it like a failure: call
`update-graph.mjs fail` for it with reason `"stale active status from a
previous cycle"` before continuing). Break ties by whichever has the oldest
`lastCycleId` (or `null`, which counts as oldest).

The seven nodes and what "doing the work" means for each:

| node | what this cycle does |
|---|---|
| `research` | Investigate one open question relevant to the project (use WebSearch/WebFetch if available). Write findings to a new file under `state/memory/`. |
| `memory` | Curate: read 2+ existing `state/memory/*.md` files, merge/dedupe/tag them better, or distill them into a higher-signal summary file. Don't just add noise — this node levels up on *quality*, so prefer consolidating over appending. |
| `plan` | Read the whole graph + recent `state/log.jsonl` tail, and write a short `state/memory/plan-<cycleId>.md` describing what `build` should tackle next and why. |
| `build` | Either scaffold a new module (`node core/scripts/new-module.mjs <name> --desc "..."`) or extend an existing one under `generated/` with real implementation code, replacing stub logic. |
| `test` | Add/extend real tests for whatever `build` last touched (`generated/<name>/test/*.test.mjs`), run them, fix obvious breakage. Do not merge on red tests — see step 4. |
| `ship` | Nothing extra beyond step 4's merge — this node levels up automatically when a cycle successfully merges any change. |
| `output` | Write a short human-readable summary of what shipped this cycle to `state/memory/output-<cycleId>.md` — this is what feeds back into `memory` next time around. |

## 3. Do the work on a branch

```
git checkout -b cycle/<cycleId>-<node> main
```

Make your changes. **Only touch paths under `state/**` or `generated/**`.**
Never edit anything under `core/` (including this file) or the safety fields
in `state/control.json` (`paused`, `pauseReason`, `failureThreshold`,
`allowedPaths`, `consecutiveFailures`) — those are off-limits by design, not
by convention, and the next step will catch it if you try.

Memory file format (`state/memory/*.md`):
```
---
tags: [tag-one, tag-two]
relatedNodes: [research, memory]
createdAt: 2026-08-05T12:00:00.000Z
---

# Title

Body content.
```

## 4. Validate before merging

If the node is `build`, `test`, or touches a `generated/` module: run that
module's own tests.
```
cd generated/<name> && npm install --silent && npm test
cd -
```
If tests fail: **do not merge**. Go to step 6 (fail path).

Then, regardless of node, run the diff guardrail against what you're about to
merge:
```
node core/scripts/check-guardrails.mjs diff --base main
```
If this fails (path allow-list violation or diff too large): **do not
merge**, even if tests passed. Go to step 6 (fail path).

## 5. Merge (success path)

```
git add -A
git commit -m "cycle <cycleId>: <node> — <one-line summary>"
git checkout main
git merge --no-ff cycle/<cycleId>-<node>
git branch -d cycle/<cycleId>-<node>
```

Record the success (this also commits the `state/*` changes for you — you
don't need a separate `git commit` for graph.json/control.json/log.jsonl):
```
node core/scripts/update-graph.mjs success --node <node> --cycle <cycleId> --note "<one-line summary>"
```

Push `main` so the next cycle (a fresh clone) sees this state:
```
git push origin main
```

Then **stop** — cycle complete.

## 6. Fail path (tests red, or guardrail diff rejected, or you get stuck)

Abandon the branch, don't merge anything:
```
git checkout main
git branch -D cycle/<cycleId>-<node>
```

Record the failure (this also feeds the circuit breaker and commits the
`state/*` changes for you):
```
node core/scripts/update-graph.mjs fail --node <node> --cycle <cycleId> --reason "<what went wrong>"
```

Push `main` so the failure (and a possible pause) is visible to the next
cycle and to the dashboard:
```
git push origin main
```

Then **stop**. If this trips the circuit breaker (3 consecutive failures by
default), `update-graph.mjs` sets `paused: true` automatically — that's
expected, not an error on your part. A human will look at `state/log.jsonl`,
fix or accept the situation, and resume via the dashboard or
`node core/scripts/update-graph.mjs resume`.

## Hard limits, always

- One node, one cycle. Never work on more than one node per invocation.
- Whether you're a scheduled cloud cycle or a manually triggered local one,
  step 0's sync is what keeps both starting points consistent — don't skip
  it because "this is probably already current."
- The only thing you ever push is `main`, and only after step 5 or step 6's
  `update-graph.mjs` call. Never push a feature branch, never force-push,
  never push anything the guardrail diff-check rejected.
- If a push in step 5/6 is rejected (another cycle — cloud or local — pushed
  in between): the commit already happened locally, so nothing is lost, but
  do not force-push and do not attempt to merge/rebase `state/*` yourself —
  those files aren't line-mergeable in a way that's safe to automate. Leave
  it for the next invocation's step-0 sync (or a human) to reconcile.
- Never modify `core/**` or `control.json`'s safety fields, even to "fix" something — flag it in the failure reason instead and stop.
- If anything is ambiguous or you're not confident the change is safe, prefer the fail path over guessing.
