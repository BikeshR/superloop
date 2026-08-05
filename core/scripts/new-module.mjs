#!/usr/bin/env node
// core/scripts/new-module.mjs
//
// Scaffolds a new folder+package under generated/<name>. This is the only
// sanctioned way for a cycle to start a new module -- it guarantees every
// generated module has a package.json with a real `test` script from the
// start, so the "test" node in the loop always has something to run.
//
// Usage: node new-module.mjs <name> [--desc "what this module does"]

import fs from "node:fs";
import path from "node:path";
import { PATHS, parseArgs, fail, ok } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const name = args._[0];

if (!name) fail("usage: node new-module.mjs <name> [--desc \"...\"]");
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
  fail(`invalid module name "${name}" -- use kebab-case, e.g. "log-summarizer"`);
}

const dir = path.join(PATHS.generated, name);
if (fs.existsSync(dir)) {
  fail(`generated/${name} already exists -- extend it directly instead of creating a new module`);
}

const desc = args.desc ?? "";

fs.mkdirSync(path.join(dir, "src"), { recursive: true });
fs.mkdirSync(path.join(dir, "test"), { recursive: true });

fs.writeFileSync(
  path.join(dir, "package.json"),
  JSON.stringify(
    {
      name: `@generated/${name}`,
      private: true,
      version: "0.0.0",
      type: "module",
      description: desc,
      scripts: {
        test: "node --test test/",
      },
    },
    null,
    2
  ) + "\n"
);

fs.writeFileSync(
  path.join(dir, "src", "index.mjs"),
  `// generated/${name}/src/index.mjs\n// ${desc || "(no description yet)"}\n\nexport function placeholder() {\n  return true;\n}\n`
);

fs.writeFileSync(
  path.join(dir, "test", "index.test.mjs"),
  `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { placeholder } from "../src/index.mjs";\n\ntest("placeholder passes -- replace with a real test for this module", () => {\n  assert.equal(placeholder(), true);\n});\n`
);

fs.writeFileSync(
  path.join(dir, "README.md"),
  `# ${name}\n\n${desc || "(no description yet)"}\n\nCreated by the superloop \`build\` node. Replace this stub with real\nimplementation and tests before shipping.\n`
);

ok({ created: `generated/${name}`, files: ["package.json", "src/index.mjs", "test/index.test.mjs", "README.md"] });
