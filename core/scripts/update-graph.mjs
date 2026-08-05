#!/usr/bin/env node
// core/scripts/update-graph.mjs
//
// The ONLY sanctioned way to mutate state/graph.json and state/control.json.
// A cycle should call this instead of hand-editing the JSON, so the schema
// stays valid and level/unlock/circuit-breaker math stays in one place.
//
// Usage:
//   node update-graph.mjs success --node <id> --cycle <cycleId> [--note "..."]
//   node update-graph.mjs fail    --node <id> --cycle <cycleId> --reason "..."
//   node update-graph.mjs pause   --reason "..."
//   node update-graph.mjs resume
//   node update-graph.mjs status

import {
  PATHS,
  readJson,
  writeJson,
  appendLog,
  nowIso,
  assertGraphShape,
  assertControlShape,
  recomputeUnlocks,
  parseArgs,
  fail,
  ok,
} from "./lib.mjs";

function loadState() {
  const graph = readJson(PATHS.graph);
  const control = readJson(PATHS.control);
  assertGraphShape(graph);
  assertControlShape(control);
  return { graph, control };
}

function saveState(graph, control) {
  graph.updatedAt = nowIso();
  writeJson(PATHS.graph, graph);
  writeJson(PATHS.control, control);
}

function cmdSuccess(args) {
  const { graph, control } = loadState();
  if (control.paused) fail("loop is paused -- resume before recording cycles");

  const node = graph.nodes.find((n) => n.id === args.node);
  if (!node) fail(`unknown node id: ${args.node}`);
  if (!args.cycle) fail("--cycle <cycleId> is required");

  node.xp += control.xpPerSuccess;
  node.level = Math.floor(node.xp / control.xpPerLevel);
  node.status = "unlocked";
  node.lastCycleId = args.cycle;

  recomputeUnlocks(graph);

  control.consecutiveFailures = 0;
  control.lastCycleId = args.cycle;
  control.lastCycleAt = nowIso();
  control.totalCycles += 1;

  saveState(graph, control);
  appendLog({
    cycleId: args.cycle,
    node: node.id,
    result: "success",
    levelAfter: node.level,
    xpAfter: node.xp,
    note: args.note ?? null,
  });
  ok({ node: node.id, level: node.level, xp: node.xp });
}

function cmdFail(args) {
  const { graph, control } = loadState();
  const node = graph.nodes.find((n) => n.id === args.node);
  if (!node) fail(`unknown node id: ${args.node}`);
  if (!args.cycle) fail("--cycle <cycleId> is required");
  if (!args.reason) fail("--reason \"...\" is required");

  node.status = node.status === "active" ? "unlocked" : node.status;
  node.lastCycleId = args.cycle;

  control.consecutiveFailures += 1;
  control.lastCycleId = args.cycle;
  control.lastCycleAt = nowIso();
  control.totalCycles += 1;

  let breakerTripped = false;
  if (control.consecutiveFailures >= control.failureThreshold) {
    control.paused = true;
    control.pauseReason = `circuit breaker: ${control.consecutiveFailures} consecutive failures (threshold ${control.failureThreshold})`;
    breakerTripped = true;
  }

  saveState(graph, control);
  appendLog({ cycleId: args.cycle, node: node.id, result: "fail", reason: args.reason });
  if (breakerTripped) {
    appendLog({ cycleId: args.cycle, result: "paused", reason: control.pauseReason });
  }
  ok({ node: node.id, consecutiveFailures: control.consecutiveFailures, paused: control.paused });
}

function cmdPause(args) {
  const { graph, control } = loadState();
  control.paused = true;
  control.pauseReason = args.reason ?? "paused by hand";
  saveState(graph, control);
  appendLog({ result: "paused", reason: control.pauseReason });
  ok({ paused: true, reason: control.pauseReason });
}

function cmdResume() {
  const { graph, control } = loadState();
  control.paused = false;
  control.pauseReason = null;
  control.consecutiveFailures = 0;
  saveState(graph, control);
  appendLog({ result: "resumed" });
  ok({ paused: false });
}

function cmdStatus() {
  const { graph, control } = loadState();
  ok({ graph, control });
}

const args = parseArgs(process.argv.slice(2));
const sub = args._[0];

switch (sub) {
  case "success":
    cmdSuccess(args);
    break;
  case "fail":
    cmdFail(args);
    break;
  case "pause":
    cmdPause(args);
    break;
  case "resume":
    cmdResume();
    break;
  case "status":
    cmdStatus();
    break;
  default:
    console.error("usage: node update-graph.mjs <success|fail|pause|resume|status> [flags]");
    process.exit(2);
}
