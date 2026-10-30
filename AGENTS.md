# AGENTS.md

Epoch of Kingdoms is a single-player browser RTS in the lineage of Age of Empires II: one
seeded map, two kingdoms, a deterministic simulation, and a conquest victory. Read
`GLOSSARY.md` before naming anything.

## Commands

- `npm run dev` — Vite dev server.
- `npm test` — Vitest simulation suite.
- `npm run test:e2e` — Playwright browser suite (starts its own server).
- `npm run check` — typecheck + lint + unit tests + build. The merge gate.
- `npm run screenshot` — regenerate `docs/media/game.png` from a deterministic match.

## Where things live

- `src/sim/` — headless, deterministic world. No DOM, no canvas, no wall clock, no
  `Math.random`. All mutation flows through commands applied at tick boundaries.
- `src/render/` — isometric projection, chunked terrain, procedural sprites, fog, minimap.
  Reads the world; never writes it.
- `src/ui/` — DOM HUD, command card, menus, input mapping.
- `src/audio/` — procedural WebAudio effects.
- `tests/` — Vitest at the simulation seam. `e2e/` — Playwright at the page seam.
- `docs/adr/` — decisions that are costly to reverse. `docs/agents/` — tracker and domain
  conventions. `.scratch/` — local agent scratch space, git-ignored.

## Issue tracker

Specs and tickets are GitHub issues in `gerrcass/epoch-of-kingdoms`, with native blocking
edges. See `docs/agents/issue-tracker.md` for the exact commands.

## Domain docs

One context. `GLOSSARY.md` is the vocabulary; `docs/adr/` holds the decisions. See
`docs/agents/domain.md`.

## Review standard

`CODING_STANDARDS.md` is read by the reviewer, not restated here. A change is ready when
`npm run check` passes, the demo path it claims works in a browser, and any visual change has
a screenshot in the PR.
