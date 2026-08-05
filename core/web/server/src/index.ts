import express from "express";
import path from "node:path";
import fs from "node:fs";
import { ROOT, readGraph, readControl, writeControl, readLog, appendLog, commitStateChange, syncFromOrigin } from "./state.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4319);
const SYNC_INTERVAL_MS = 20_000;

// Cloud-scheduled cycles push their results to origin/main; pull those in
// periodically so the dashboard reflects them without a human running
// `git pull` by hand. Best-effort — see syncFromOrigin's doc comment.
syncFromOrigin();
setInterval(syncFromOrigin, SYNC_INTERVAL_MS);

app.get("/api/state", (_req, res) => {
  try {
    res.json({ graph: readGraph(), control: readControl() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/log", (req, res) => {
  const since = typeof req.query.since === "string" ? req.query.since : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  try {
    res.json({ entries: readLog({ since, limit }) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/control", express.json(), (req, res) => {
  try {
    const control = readControl();
    const body = req.body ?? {};

    if (typeof body.paused === "boolean") {
      control.paused = body.paused;
      control.pauseReason = body.paused ? (body.reason ?? "paused via dashboard") : null;
      if (!body.paused) control.consecutiveFailures = 0;
      appendLog({ result: body.paused ? "paused" : "resumed", reason: control.pauseReason });
    }
    if (typeof body.cadenceHours === "number" && body.cadenceHours > 0) {
      control.cadenceHours = body.cadenceHours;
    }

    writeControl(control);
    commitStateChange(
      typeof body.paused === "boolean"
        ? body.paused
          ? `loop paused: ${control.pauseReason}`
          : "loop resumed"
        : "control.json updated via dashboard"
    );
    res.json({ ok: true, control });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Serve the built dashboard client, if it exists (production mode). In dev,
// the Vite dev server serves the client on its own port and proxies /api/*
// here instead.
const clientDist = path.join(ROOT, "core", "web", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`superloop dashboard server listening on http://localhost:${PORT}`);
});
