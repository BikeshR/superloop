import express from "express";
import path from "node:path";
import fs from "node:fs";
import { ROOT, readGraph, readControl, writeControl, readLog, appendLog } from "./state.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4319);

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
