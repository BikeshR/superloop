# superloop

An autonomous AI loop that builds on its own state, cycle after cycle, with
no human driving it in real time — visualized as an Upload-Labs-style
tech-tree/pipeline dashboard.

Each cycle picks one node in the graph below, does its work, validates it,
and either ships it or reverts and logs the failure. The next cycle picks up
wherever the last one left off.

```
research → memory → plan → build → test → ship → output → (feeds back into memory)
```

## Layout

```
core/            hand-authored, off-limits to the loop
  CYCLE.md       the instructions a scheduled agent follows for ONE cycle
  scripts/       update-graph.mjs · new-module.mjs · check-guardrails.mjs
  web/           the dashboard (Express server + Vite/TS client)
state/           the loop's live state — the only thing outside `generated/`
                 a cycle is allowed to touch
  graph.json     node levels/xp/status/dependencies
  control.json   pause flag, circuit breaker, cadence, limits
  log.jsonl      append-only event log, one line per cycle action
  memory/        the knowledge base a cycle reads from and writes to (the RAG corpus)
generated/       everything the loop has built — new modules, each with its
                 own package.json + tests, tracked in this same repo/history
```

`core/` and `generated/` live in one repo on purpose — there's no separate
repo-per-module. The boundary is enforced instead: `check-guardrails.mjs diff`
diffs a cycle's branch against `main` and refuses to merge anything that
touches `core/**` or `control.json`'s safety fields, tests notwithstanding.

## Running the dashboard

```
npm install
npm run dev:server    # http://localhost:4319 — the API, reads/writes state/
npm run dev:client     # http://localhost:5173 — the UI, proxies /api to the server
```

For a single-process production-style run:
```
npm run build:client
npm start              # builds nothing else; serves the built client from the server
```

## Running a cycle by hand

A cycle is just a Claude Code agent given `core/CYCLE.md` as its task —
there's no separate script that "is" the loop:

```
# with claude code cli, from the repo root:
claude "Follow core/CYCLE.md and run exactly one cycle."
```

It will check `state/control.json` first and refuse to do anything if
`paused: true`.

## Safety rails

- **Sandboxed branch per cycle** — work happens on `cycle/<id>-<node>`, never directly on `main`.
- **Path allow-list** — `check-guardrails.mjs diff` rejects any merge touching outside `state/**` + `generated/**`.
- **Auto-revert** — failing tests or a rejected diff means the branch is discarded, not merged.
- **Circuit breaker** — 3 consecutive failures (`state/control.json.failureThreshold`) auto-pauses the loop.
- **Pause/kill-switch** — flip `state/control.json.paused`, or use the dashboard's Pause button (`POST /api/control`).
- **No auto-push** — this stays a local repo; pushing anywhere is a manual step you take yourself.

To resume after a pause:
```
node core/scripts/update-graph.mjs resume
```
or use the Resume button on the dashboard.

## Scheduling it for real

Once you've run a few cycles by hand and are happy with what `generated/`
looks like, register a recurring routine (via this environment's `/schedule`
skill) that runs `core/CYCLE.md` against this repo on a cadence — default
recommendation is every 4 hours (6 cycles/day). That's what makes it
actually unsupervised instead of something you have to remember to kick off.
