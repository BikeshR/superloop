import { fetchState, fetchLog, setPaused } from "./api";
import { renderGraph, pulseNode } from "./graph-render";
import type { Control, Graph, LogEntry } from "./types";

const POLL_MS = 3000;

const app = document.getElementById("app")!;
app.innerHTML = `
  <header>
    <div>
      <h1>superloop</h1>
      <div class="subtitle">autonomous cycle dashboard</div>
    </div>
    <div class="controls">
      <span id="status-pill" class="status-pill">…</span>
      <button id="pause-btn">Pause</button>
    </div>
  </header>
  <div class="panel">
    <h2>Node graph</h2>
    <svg id="graph-svg"></svg>
  </div>
  <div class="panel">
    <h2>Cycle log</h2>
    <ul id="log-feed"></ul>
  </div>
`;

const svg = document.getElementById("graph-svg") as unknown as SVGSVGElement;
const statusPill = document.getElementById("status-pill")!;
const pauseBtn = document.getElementById("pause-btn") as HTMLButtonElement;
const logFeed = document.getElementById("log-feed")!;

let currentControl: Control | null = null;
let lastLogTs: string | undefined;
const seenNodesForPulse = new Set<string>();

function renderStatus(control: Control) {
  currentControl = control;
  statusPill.textContent = control.paused ? `paused${control.pauseReason ? `: ${control.pauseReason}` : ""}` : "running";
  statusPill.className = `status-pill ${control.paused ? "paused" : "running"}`;
  pauseBtn.textContent = control.paused ? "Resume" : "Pause";
}

function appendLogEntries(entries: LogEntry[], graph: Graph) {
  for (const entry of entries) {
    const li = document.createElement("li");
    li.className = `result-${entry.result}`;
    const ts = document.createElement("span");
    ts.className = "ts";
    ts.textContent = new Date(entry.ts).toLocaleTimeString();
    const nodeTag = document.createElement("span");
    nodeTag.className = "node-tag";
    nodeTag.textContent = entry.node ?? "";
    const msg = document.createElement("span");
    msg.className = "msg";
    msg.textContent =
      entry.result === "success"
        ? `${entry.node} → level ${entry.levelAfter} (${entry.note ?? "ok"})`
        : entry.result === "fail"
          ? `${entry.node} failed: ${entry.reason}`
          : entry.reason ?? entry.result;
    li.append(ts, nodeTag, msg);
    logFeed.appendChild(li);

    if ((entry.result === "success" || entry.result === "fail") && entry.node) {
      pulseNode(svg, entry.node, entry.result === "success" ? "success" : "fail");
    }
    lastLogTs = entry.ts;
  }
  // cap displayed history so the panel doesn't grow unbounded in a long session
  while (logFeed.children.length > 300) {
    logFeed.removeChild(logFeed.firstChild!);
  }
}

async function pollState() {
  try {
    const { graph, control } = await fetchState();
    renderGraph(svg, graph, control);
    renderStatus(control);
  } catch (err) {
    statusPill.textContent = "dashboard: server unreachable";
    statusPill.className = "status-pill paused";
    console.error(err);
  }
}

async function pollLog() {
  try {
    const entries = await fetchLog(lastLogTs);
    if (entries.length) {
      // fetchState may not have run yet on first tick; graph is only used for
      // future per-node context, current pulse logic only needs the svg.
      appendLogEntries(entries, { nodes: [], edges: [], $schemaVersion: 1, updatedAt: null });
    }
  } catch (err) {
    console.error(err);
  }
}

pauseBtn.addEventListener("click", async () => {
  if (!currentControl) return;
  pauseBtn.disabled = true;
  try {
    await setPaused(!currentControl.paused, !currentControl.paused ? "paused via dashboard" : undefined);
    await pollState();
  } finally {
    pauseBtn.disabled = false;
  }
});

pollState();
pollLog();
setInterval(pollState, POLL_MS);
setInterval(pollLog, POLL_MS);
