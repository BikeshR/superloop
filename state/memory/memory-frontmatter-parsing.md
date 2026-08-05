---
tags: [memory-index, parsing, build, tooling]
relatedNodes: [research, build]
createdAt: 2026-08-05T00:00:00.000Z
---

# How to parse `state/memory/*.md` front-matter without a YAML dependency

Follow-on to [`first-build-module-candidates.md`](./first-build-module-candidates.md),
which recommended `memory-index` as the strongest first `generated/` module but
left the actual parsing approach as an open question. This cycle works that
question through so `build` can implement it directly instead of re-deriving
it mid-cycle.

## What the format actually looks like today

Both existing memory files use the identical shape (checked
`upload-labs-ui-patterns.md` and `first-build-module-candidates.md` byte for
byte):

```
---
tags: [tag-one, tag-two]
relatedNodes: [research, memory]
createdAt: 2026-08-05T12:00:00.000Z
---

# Title
Body...
```

Three keys only, every time: `tags` (bracketed, comma-separated, unquoted
kebab-case words), `relatedNodes` (same shape, values are always one of the
seven node ids), `createdAt` (a bare ISO-8601 timestamp, unquoted). No nested
maps, no multiline scalars, no quoted strings, no `#` comments inside the
block. `CYCLE.md` itself prescribes this exact three-key template in its
"Memory file format" section — so this isn't just current-file convention,
it's the contract every future file is written against too.

## Why a real YAML parser is the wrong call

`core/scripts/lib.mjs` is explicit that the `core/` tooling stays
dependency-free ("no zod, no glob libs") so scripts run with nothing but
`node`. The same reasoning applies to `generated/memory-index`: pulling in
`js-yaml` (or similar) to parse a three-key, one-level, flow-sequence-only
subset would be a large dependency for a tiny grammar, and it would let
`generated/` silently diverge from the "no `npm install` needed beyond what
`new-module.mjs` scaffolds" pattern `build` has followed so far.

## Minimal parsing approach that covers the real grammar

The front-matter block is delimited by a `---` line at the very top and the
next `---` line. Within it, every line is `key: value`. The only value shapes
that appear (per `CYCLE.md`'s own template) are bracketed lists and bare
scalars, so a parser doesn't need a tokenizer:

1. Split the file on `\n`, find the two `---` delimiter lines, slice between
   them.
2. For each line, split on the first `:`.
3. If the trimmed value starts with `[` and ends with `]`, strip the
   brackets and split on `,`, trimming each item (empty string → `[]`).
4. Otherwise keep the trimmed value as a plain string (`createdAt` needs no
   further parsing — ISO strings sort and `Date()`-parse fine as strings).

This is ~15 lines, has no failure modes for the grammar actually in use, and
degrades safely (a malformed file just yields fewer/odd fields rather than
throwing) — appropriate for a tool that skims memory, not one that gates
correctness. It should still validate loudly if the two `---` delimiters
aren't found at all, so a genuinely broken file surfaces rather than being
silently skipped.

## Recommendation for the `build` cycle that implements `memory-index`

Implement exactly the 4-step parser above as a pure function
(`parseFrontMatter(content) -> {tags, relatedNodes, createdAt, body}`), plus a
directory-scan wrapper that maps it over `state/memory/*.md`. Keep it
dependency-free per the `core/` precedent. Add a fixture-based test with at
least: a well-formed file (both existing memory files work as fixtures
as-is), an empty-array case (`tags: []`), and a missing-delimiter case to
confirm the loud-failure path.
