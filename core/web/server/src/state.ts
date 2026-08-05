// Thin, dependency-free read/write layer over state/*. Deliberately doesn't
// import core/scripts/lib.mjs (kept separate: that lib is the CLI mutator's
// contract, this is the dashboard's read + narrow pause/resume write path) —
// duplicating a few lines of JSON I/O here is cheaper than coupling a TS
// build to a plain-.mjs sibling package.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/ (or dist/) -> server -> web -> core -> repo root
export const ROOT = path.resolve(__dirname, "../../../..");

export const STATE_PATHS = {
  graph: path.join(ROOT, "state", "graph.json"),
  control: path.join(ROOT, "state", "control.json"),
  log: path.join(ROOT, "state", "log.jsonl"),
};

export interface GraphNode {
  id: string;
  label: string;
  kind: string;
  level: number;
  xp: number;
  status: "locked" | "unlocked" | "active";
  dependsOn: { id: string; minLevel: number }[];
  lastCycleId: string | null;
}

export interface Graph {
  $schemaVersion: number;
  updatedAt: string | null;
  nodes: GraphNode[];
  edges: { from: string; to: string }[];
}

export interface Control {
  $schemaVersion: number;
  paused: boolean;
  pauseReason: string | null;
  consecutiveFailures: number;
  failureThreshold: number;
  cadenceHours: number;
  xpPerSuccess: number;
  xpPerLevel: number;
  maxDiffFiles: number;
  maxDiffLines: number;
  allowedPaths: string[];
  lastCycleId: string | null;
  lastCycleAt: string | null;
  totalCycles: number;
}

export interface LogEntry {
  ts: string;
  cycleId?: string;
  node?: string;
  result: string;
  [key: string]: unknown;
}

export function readGraph(): Graph {
  return JSON.parse(fs.readFileSync(STATE_PATHS.graph, "utf8"));
}

export function readControl(): Control {
  return JSON.parse(fs.readFileSync(STATE_PATHS.control, "utf8"));
}

export function writeControl(control: Control): void {
  fs.writeFileSync(STATE_PATHS.control, JSON.stringify(control, null, 2) + "\n");
}

export function appendLog(entry: Omit<LogEntry, "ts">): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  fs.appendFileSync(STATE_PATHS.log, line + "\n");
}

/** Mirrors core/scripts/lib.mjs's commitStateChange -- the dashboard's
 *  pause/resume button mutates control.json directly, so it needs to leave
 *  a clean, committed working tree too, same as the CLI mutator does.
 *
 *  Also pushes `main` (best-effort, never throws). This is what makes the
 *  dashboard's Pause button actually reach cloud-scheduled cycles -- they
 *  clone fresh from origin each run, so an unpushed pause is invisible to
 *  them. */
export function commitStateChange(message: string): void {
  execSync(`git add state/graph.json state/control.json state/log.jsonl`, { cwd: ROOT });
  const staged = execSync(`git diff --cached --name-only`, { cwd: ROOT, encoding: "utf8" }).trim();
  if (!staged) return;
  execSync(`git commit -q -m ${JSON.stringify(message)}`, { cwd: ROOT });
  try {
    execSync(`git push origin main --quiet`, { cwd: ROOT });
  } catch (err) {
    console.warn("commitStateChange: push failed (committed locally, will retry next time) —", (err as Error).message.split("\n")[0]);
  }
}

/** Cycles run in isolated cloud sandboxes and push their results to
 *  `origin/main` -- this machine's checkout only sees that work once it
 *  pulls. Best-effort, fast-forward only: if the remote has moved on and a
 *  local dashboard action (pause/resume) hasn't been pushed, this no-ops
 *  rather than risking a merge. Never throws -- a stale dashboard view is
 *  fine, corrupting state is not. */
export function syncFromOrigin(): void {
  try {
    execSync(`git fetch origin main --quiet`, { cwd: ROOT });
    execSync(`git merge --ff-only origin/main --quiet`, { cwd: ROOT });
  } catch (err) {
    console.warn("syncFromOrigin: skipped (no remote, no network, or diverged) —", (err as Error).message.split("\n")[0]);
  }
}

export function readLog(opts: { since?: string; limit?: number } = {}): LogEntry[] {
  if (!fs.existsSync(STATE_PATHS.log)) return [];
  const raw = fs.readFileSync(STATE_PATHS.log, "utf8");
  let entries = raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as LogEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is LogEntry => e !== null);

  if (opts.since) {
    const sinceMs = Date.parse(opts.since);
    if (!Number.isNaN(sinceMs)) {
      entries = entries.filter((e) => Date.parse(e.ts) > sinceMs);
    }
  }
  const limit = opts.limit ?? 200;
  if (entries.length > limit) entries = entries.slice(-limit);
  return entries;
}
