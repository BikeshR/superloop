// Shared helpers for the core/scripts/* CLIs. Deliberately dependency-free
// (no zod, no glob libs) so these scripts run with nothing but `node`.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

export const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");

export const PATHS = {
  graph: path.join(ROOT, "state", "graph.json"),
  control: path.join(ROOT, "state", "control.json"),
  log: path.join(ROOT, "state", "log.jsonl"),
  memory: path.join(ROOT, "state", "memory"),
  generated: path.join(ROOT, "generated"),
};

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

export function appendLog(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  fs.appendFileSync(PATHS.log, line + "\n");
}

export function nowIso() {
  return new Date().toISOString();
}

/** Throws with a clear message if graph.json doesn't look like what we expect.
 *  Not a full JSON-Schema validator — just enough to fail loud instead of
 *  silently corrupting state if something upstream produced garbage. */
export function assertGraphShape(graph) {
  const problems = [];
  if (!graph || typeof graph !== "object") problems.push("graph is not an object");
  if (!Array.isArray(graph?.nodes)) problems.push("graph.nodes is not an array");
  if (!Array.isArray(graph?.edges)) problems.push("graph.edges is not an array");
  for (const n of graph?.nodes ?? []) {
    if (typeof n.id !== "string") problems.push(`node missing string id: ${JSON.stringify(n)}`);
    if (typeof n.level !== "number") problems.push(`node ${n.id}: level is not a number`);
    if (typeof n.xp !== "number") problems.push(`node ${n.id}: xp is not a number`);
    if (!["locked", "unlocked", "active"].includes(n.status)) {
      problems.push(`node ${n.id}: invalid status "${n.status}"`);
    }
    if (!Array.isArray(n.dependsOn)) problems.push(`node ${n.id}: dependsOn is not an array`);
  }
  if (problems.length) {
    throw new Error("graph.json failed shape validation:\n  " + problems.join("\n  "));
  }
}

export function assertControlShape(control) {
  const problems = [];
  if (!control || typeof control !== "object") problems.push("control is not an object");
  if (typeof control?.paused !== "boolean") problems.push("control.paused is not a boolean");
  if (typeof control?.consecutiveFailures !== "number") problems.push("control.consecutiveFailures is not a number");
  if (typeof control?.failureThreshold !== "number") problems.push("control.failureThreshold is not a number");
  if (!Array.isArray(control?.allowedPaths)) problems.push("control.allowedPaths is not an array");
  if (problems.length) {
    throw new Error("control.json failed shape validation:\n  " + problems.join("\n  "));
  }
}

/** Recompute locked/unlocked status for every node from current levels. Never
 *  downgrades a node out of "active" here — that's set/cleared by the caller
 *  around the work being done. */
export function recomputeUnlocks(graph) {
  const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  for (const node of graph.nodes) {
    if (node.status === "active") continue;
    const satisfied = node.dependsOn.every((dep) => (byId[dep.id]?.level ?? 0) >= dep.minLevel);
    if (satisfied && node.status === "locked") node.status = "unlocked";
    if (!satisfied && node.status === "unlocked") node.status = "locked";
  }
  return graph;
}

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok.startsWith("--")) {
      const key = tok.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(tok);
    }
  }
  return args;
}

export function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}

export function ok(payload) {
  console.log(JSON.stringify({ ok: true, ...payload }, null, 2));
}
