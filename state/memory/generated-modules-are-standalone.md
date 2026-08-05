---
tags: [architecture, generated, ship, build, planning]
relatedNodes: [research, build, ship, plan]
createdAt: 2026-08-05T00:00:00.000Z
---

# Nothing in `core/` ever imports from `generated/` — and that's by design, not a gap

Open question going into this cycle: two module candidates are already
queued (`memory-index`, `log-summarizer` — see
[`first-build-module-candidates.md`](./first-build-module-candidates.md) and
[`log-jsonl-event-shapes.md`](./log-jsonl-event-shapes.md)), both framed
around serving a *future* cycle (`plan` skimming memory, `output` quoting a
rollup). Before `build` scaffolds either one, it's worth confirming: does
anything actually *consume* a `generated/` module once it exists, or do
these just sit there?

## What was checked

`grep -rn "generated" core/` turns up only `new-module.mjs` (scaffolds into
`generated/`) and `CYCLE.md` (tells `build`/`test` to work under
`generated/`). Read both `core/web/server/src/{index,state}.ts` in full:
the dashboard reads `state/graph.json`, `state/control.json`, and
`state/log.jsonl` **directly**, with its own dependency-free JSON/JSONL
readers duplicated from `core/scripts/lib.mjs` (the file's own top comment
says this is deliberate — "kept separate... duplicating a few lines of JSON
I/O here is cheaper than coupling a TS build to a plain-.mjs sibling
package"). It does not import anything from `generated/`, and per `README.md`
`core/` is explicitly "hand-authored, off-limits to the loop" — so no future
cycle can go wire a module into the dashboard's server even if it wanted to.

## What this means

`generated/` modules are **standalone artifacts**, not services wired into
anything automatically. "Shipping" a module (the `ship` node) means exactly
what `CYCLE.md` already says and no more: "nothing extra beyond step 4's
merge... levels up automatically when a cycle successfully merges any
change." There is no implicit expectation that `memory-index` gets imported
by the dashboard, or that `log-summarizer`'s output shows up in a UI —
proving each module works via its own `npm test` (per package, per
`new-module.mjs`'s scaffold) is the entire bar.

This matters for how `build`/`test` should scope their work: don't treat
"is anything calling this?" as a blocker or a TODO to chase into `core/`.
The consumer, if one ever exists, is either a human reading `generated/`
output directly, or a *later cycle* explicitly invoking the module's
exported functions in its own work (e.g. a hypothetical future `memory`
cycle could `import` from `generated/memory-index` to do its curation, the
same way `plan` might one day read a `log-summarizer` rollup by running it
ad hoc) — never an automatic wiring `build` needs to construct itself.

## Recommendation

No change to the `memory-index` / `log-summarizer` priority order from
prior research — both are still good targets. This just removes a false
constraint: `build` should implement each module to be correct and
independently testable, not to be "integrated" anywhere, since there is
deliberately no integration surface inside `core/` for it to reach.
