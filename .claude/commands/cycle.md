Follow core/CYCLE.md exactly, step by step, and run exactly one cycle of the
superloop end to end: sync + guardrail pre-check, orient on state/graph.json
+ state/control.json + state/memory, pick the next node per its rules, do
that node's work on a fresh branch, validate (tests + the guardrail diff
check), then either merge and record success or revert and record failure
via core/scripts/update-graph.mjs, finishing with a push to origin/main as
CYCLE.md instructs. Do not loop internally and do not start a second cycle —
one invocation is exactly one cycle, then stop. If the guardrail pre-check
says the loop is paused, or step 0's sync finds local main diverged from
origin, stop immediately without doing anything else and report why.
