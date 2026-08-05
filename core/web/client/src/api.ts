import type { LogEntry, StateResponse } from "./types";

export async function fetchState(): Promise<StateResponse> {
  const res = await fetch("/api/state");
  if (!res.ok) throw new Error(`GET /api/state failed: ${res.status}`);
  return res.json();
}

export async function fetchLog(since?: string): Promise<LogEntry[]> {
  const url = since ? `/api/log?since=${encodeURIComponent(since)}` : "/api/log";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET /api/log failed: ${res.status}`);
  const data = await res.json();
  return data.entries as LogEntry[];
}

export async function setPaused(paused: boolean, reason?: string): Promise<void> {
  const res = await fetch("/api/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paused, reason }),
  });
  if (!res.ok) throw new Error(`POST /api/control failed: ${res.status}`);
}
