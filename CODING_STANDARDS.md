# CODING STANDARDS

Read this when reviewing a change. Implementation agents should know the rules but should not
need to re-read this file on every edit; it exists to make review deterministic.

## Simulation

- `src/sim/` must run in Node. A DOM, canvas, `window`, `performance`, `Date.now`, or
  `Math.random` import there is a defect.
- All player-visible mutation crosses the command boundary. Renderers and UI read state; they
  never write it.
- A tick applies queued commands, then systems in a fixed order, then resolves deaths. Entity
  iteration order is stable (ascending id) so replays and tests are reproducible.
- Every random draw uses the world's seeded `Rng`; never a module-level generator.
- A new stat belongs in the content tables, not hard-coded in a system. A new rule belongs in a
  named system function with a test at the command boundary.

## Architecture

- `sim` imports nothing from `render` or `ui`. `render` imports `sim` types and pure helpers.
  `ui` may import both. `main.ts` is the only place that wires them together.
- Prefer plain data and pure functions over classes with hidden state. A class is warranted for
  caches and the renderer, not for entities.
- Keep one source of truth per rule. If the HUD needs a cost, it reads the content table; it
  never copies the number.
- Avoid per-frame allocation in render hot paths. Reuse arrays and objects; cache gradients,
  chunk canvases, and sprite atlases.

## TypeScript and style

- `strict` is on. No `any` in exported signatures; `unknown` plus narrowing at boundaries.
- Exhaustive switches over unions; a missing case is a type error.
- Names come from `GLOSSARY.md` (kingdom, villager, drop-off, tick, command). Code identifiers
  may shorten them (`Villager`, `BuildingKind`) but must not invent synonyms (`peasant`,
  `base`, `frame` for tick).
- Comments explain *why*, not *what*. No commented-out code.
- Formatting and lint are enforced by the configured tools; review does not debate style.

## UI and accessibility

- Every command-card action is a real `<button>` with an accessible name, a hotkey, cost, and a
  disabled reason exposed as `title`/`aria-description`.
- Colour is never the only signal: selection, health, resources, and fog each carry a shape,
  outline, or text cue as well.
- Respect `prefers-reduced-motion`; disable screen shake, floating text, and decorative
  particles when it is set.
- The game is playable with the mouse plus the documented keyboard shortcuts. Pause is always
  one key away.

## Tests

- Unit tests assert external behaviour at the command boundary: issue commands, step ticks,
  assert resources, entity counts, positions, health, victory. Do not test private helpers.
- Determinism is a test: same seed and commands produce the same state hash.
- Browser tests assert what a player can see: the canvas paints, the HUD updates, a command
  changes the world, fog reveals. They use the debug handle for setup, not for the assertion
  where a visible signal exists.
- A bug fix lands with the test that would have caught it.

## Delivery

- `npm run check` green, then `npm run test:e2e` green for PRs that touch the page.
- Every visual change includes a before/after screenshot attached to the PR.
- No new runtime dependency without an ADR. Dev dependencies need a one-line justification in
  the PR.
- No secrets, no analytics, no network calls at runtime. The build must work from `file://`-like
  static hosting under a subpath.
