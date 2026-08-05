#!/usr/bin/env node
// core/scripts/check-guardrails.mjs
//
// Two jobs, both read-only (never mutates state):
//
//   node check-guardrails.mjs pre
//     Run BEFORE any work starts. Fails (exit 1) if the loop is paused.
//
//   node check-guardrails.mjs diff [--base main] [--maxFiles N] [--maxLines N]
//     Run BEFORE merging a cycle's branch. Fails (exit 1) if anything
//     changed outside control.json's allowedPaths, or if the diff is
//     bigger than the configured limits. This is the actual enforcement
//     mechanism keeping core/ off-limits to the loop -- not a promise in a
//     prompt, a check in code that a merge can't get past.
//
// Exit code 0 + {ok:true} means "proceed". Exit code 1 + {ok:false} means
// "stop, do not merge / do not do work", with a reason a cycle should log
// verbatim to state/log.jsonl.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PATHS, readJson, assertControlShape, parseArgs, fail, ok, ROOT } from "./lib.mjs";

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: "utf8" }).trim();
}

function matchesAllowedPath(filePath, allowedPaths) {
  return allowedPaths.some((pattern) => {
    if (pattern.endsWith("/**")) {
      const dir = pattern.slice(0, -3);
      return filePath === dir || filePath.startsWith(dir + "/");
    }
    return filePath === pattern;
  });
}

function cmdPre() {
  const control = readJson(PATHS.control);
  assertControlShape(control);
  if (control.paused) {
    fail(`loop is paused (${control.pauseReason ?? "no reason recorded"}) -- do not proceed`);
  }
  ok({
    consecutiveFailures: control.consecutiveFailures,
    failureThreshold: control.failureThreshold,
    cadenceHours: control.cadenceHours,
  });
}

function cmdDiff(args) {
  const control = readJson(PATHS.control);
  assertControlShape(control);

  const base = args.base ?? "main";
  const maxFiles = Number(args.maxFiles ?? control.maxDiffFiles);
  const maxLines = Number(args.maxLines ?? control.maxDiffLines);

  let trackedChanged = [];
  try {
    trackedChanged = git(`diff --name-only ${base}`).split("\n").filter(Boolean);
  } catch (e) {
    fail(`git diff against "${base}" failed: ${e.message}`);
  }
  const untracked = git(`ls-files --others --exclude-standard`).split("\n").filter(Boolean);
  const changedFiles = Array.from(new Set([...trackedChanged, ...untracked]));

  if (changedFiles.length === 0) {
    ok({ changedFiles, note: "no changes detected" });
    return;
  }

  const offending = changedFiles.filter((f) => !matchesAllowedPath(f, control.allowedPaths));
  if (offending.length > 0) {
    fail(
      `path allow-list violation -- these paths are outside ${JSON.stringify(
        control.allowedPaths
      )}: ${offending.join(", ")}`
    );
  }

  if (changedFiles.length > maxFiles) {
    fail(`too many files changed: ${changedFiles.length} > maxDiffFiles (${maxFiles})`);
  }

  let addedLines = 0;
  try {
    const shortstat = git(`diff --shortstat ${base}`);
    const m = shortstat.match(/(\d+) insertion.*?(\d+) deletion/);
    if (m) addedLines += Number(m[1]) + Number(m[2]);
    else {
      const insOnly = shortstat.match(/(\d+) insertion/);
      const delOnly = shortstat.match(/(\d+) deletion/);
      if (insOnly) addedLines += Number(insOnly[1]);
      if (delOnly) addedLines += Number(delOnly[1]);
    }
  } catch {
    // no tracked diff (e.g. only untracked new files) -- fall through to per-file counting below
  }
  // Untracked new files don't show up in `git diff --shortstat` -- count their lines directly.
  for (const f of untracked) {
    try {
      const contents = fs.readFileSync(path.join(ROOT, f), "utf8");
      addedLines += contents.split("\n").length;
    } catch {
      /* unreadable/binary file -- ignore for line counting, it still counts toward maxFiles */
    }
  }

  if (addedLines > maxLines) {
    fail(`diff too large: ${addedLines} changed lines > maxDiffLines (${maxLines})`);
  }

  ok({ changedFiles, addedLines, base });
}

const args = parseArgs(process.argv.slice(2));
const sub = args._[0];

if (sub === "pre") cmdPre();
else if (sub === "diff") cmdDiff(args);
else {
  console.error("usage: node check-guardrails.mjs <pre|diff> [--base main] [--maxFiles N] [--maxLines N]");
  process.exit(2);
}
