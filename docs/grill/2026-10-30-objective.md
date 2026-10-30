# Grill session — 2026-10-30 — Epoch of Kingdoms

**Mode:** self-driven. The operator asked for a challenging objective and delegated every
decision; each question below is answered with the recommended option, in the order a live
`/grill-with-docs` session would have asked it.

**Objective under test:** "Build an Age of Empires II clone in the browser."

The tree is worked in rounds. A question appears only when every decision above it is settled.

---

## Round 1 — the shape of the game

### Q1 — What does "clone" commit us to?

Options: (a) a screenshot-faithful remake, (b) a systems-faithful RTS with original art and
naming, (c) a base-building idle game wearing AoE2 clothes.

**Answer: (b).** The clone must reproduce the *verbs* that make AoE2 an RTS — gather, drop
off, build, age up, train, counter, scout, siege a town — not the copyrighted asset set,
campaign, civ roster, or exact stat tables. This is both the legal boundary and the honest
scope boundary. "Systems-faithful, asset-original" is the project's leading idea.

### Q2 — What is the match experience?

Options: (a) sandbox with no opponent, (b) 1v1 skirmish versus a scripted AI with a conquest
victory condition, (c) multiplayer.

**Answer: (b).** One human kingdom versus one AI kingdom. Victory: destroy the enemy Town
Center. Defeat: lose yours. Target match length 12–20 minutes on Normal. Multiplayer is a
different product (netcode, lobby, anti-cheat, sync) and is out of scope.

### Q3 — What is the visual direction?

Options: (a) tileset sampled from the original game, (b) 3D engine, (c) hand-authored
isometric 2:1 renderer with procedural art in the AoE2 silhouette language.

**Answer: (c).** 64×64-tile isometric map, 64×32 diamond tiles, warm Mediterranean palette,
chunky silhouettes: square keeps, pitched roofs, banners, tiny villagers. Everything drawn in
Canvas 2D from primitives and seeded noise. Original names: *Epoch of Kingdoms*, the
*Verdant Marches*, *Alderwatch* vs *Ravenmoor*.

### Q4 — What is the technical envelope?

Options: (a) WebGL/Three.js engine, (b) plain TypeScript + Canvas 2D + DOM HUD, (c) a game
framework.

**Answer: (b).** No runtime dependencies. Vite + TypeScript strict for the build, Canvas 2D
for the world, DOM/CSS for the HUD (crisp text, accessible buttons, easy layout). Static
output, deployable to GitHub Pages. A deterministic headless simulation core is the seam that
makes the whole thing testable.

### Q5 — How much fidelity is enough?

Minimum that still feels like AoE2: four resources, drop-off buildings, carry capacity,
houses/population, two ages, five military units with counters, farms, fog of war, minimap,
command card, control groups, attack-move, AI with a build order and attack waves, sound.
Not required: naval, monks/relics, siege weapons, unique civs, campaigns, saves, multiplayer.

**Answer: accepted as the fidelity floor.** A feature outside this list must displace one
inside it, never simply append.

---

## Round 2 — systems

### Q6 — Economy model

**Answer:** Food / wood / gold / stone. Villagers carry 10 and must return to a drop-off:
Town Center accepts everything; Mill accepts food; Lumber Camp wood; Mining Camp gold and
stone. Trees, gold, stone and berry bushes deplete and disappear. Farms are 300-food
buildings worked by one villager at a time. Houses + Town Center supply population (cap 200).
Gather rate 0.55/s base, with a short walk animation and a floating "+N" feedback.

### Q7 — Combat model

**Answer:** Melee and pierce armor; bonus damage (spear vs cavalry ×2, skirmisher vs archer
×2); attack cooldowns; arrows as travelling projectiles; auto-acquire within aggro range;
attack-move; aggressive / defensive / stand-ground stances. Units collide softly and path on
the tile grid. Buildings have HP and are valid targets. No formations.

### Q8 — AI model

**Answer:** A deterministic rule engine, not an LLM at runtime. Phases: open (2 houses, 6
villagers on food, 4 wood), feudal (Barracks + Archery Range, 12–16 villagers), pressure
(continuous army production, attack when 6+ soldiers), siege (target Town Center). Difficulty
changes decision cadence, army threshold, and a small economy multiplier on Hard; Normal
gets no resource cheats.

### Q9 — Fog of war

**Answer:** Three states per tile — unseen, explored, visible. Units and buildings project
circular vision. Enemy entities are hidden outside vision; explored terrain stays dimly
remembered. Recompute at 4 Hz, render as diamond overlays.

### Q10 — Controls and UX

**Answer:** Classic RTS grammar. Left-click select, drag box-select, shift adds, right-click
context command (move / gather / attack / deposit), A + click attack-move, control groups
Ctrl/Alt+1–9, double-click select all of type, idle-villager key, Space centers on Town
Center, WASD/arrows/edge-scroll pan, wheel zoom. Command card uses QWER/ASDF hotkeys and shows
cost, population, and disabled reasons. Minimap supports click and drag-to-pan. Pause and
1×/2× speed. Full keyboard-only path: H opens help, Tab cycles HUD regions.

---

## Round 3 — engineering and quality

### Q11 — Simulation architecture

**Answer:** Fixed 20 Hz tick (50 ms), commands queued and applied at tick boundaries, seeded
PRNG (mulberry32), rendering interpolates at display rate. The simulation is pure data +
functions; no DOM, no canvas, no `Math.random`, no wall clock. This is the single test seam.

### Q12 — Pathfinding and movement

**Answer:** A* over the 64×64 walkability grid, 8-directional without corner-cutting, binary
heap, path cache with a per-tick expansion budget. Units follow waypoints with local
separation; blocked units repath. Group orders assign staggered destinations around the
click. Buildings reserve their full footprint.

### Q13 — Performance budget

**Answer:** 60 fps at 1080p with 200 active units and 4,096 visible tiles; initial JS under
400 KB gzipped; no frame allocation storms (reuse arrays/objects). Terrain is drawn from
cached 16×16 chunk canvases. Fog and minimap update off the hot path.

### Q14 — Testing

**Answer:** Vitest on the headless simulation: determinism (same seed + commands ⇒ same
state hash), gather/drop-off, costs and population, production queues, combat counters,
pathfinding around buildings, AI reaches an army by minute N, victory detection. Playwright
for the real page: title → start → select villager → gather → build house → train soldier →
fog reveals → screenshot. A `window.__epoch` debug handle exposes deterministic test hooks.

### Q15 — Delivery

**Answer:** Trunk-based: one integration branch per spec, tickets as GitHub issues with
native blocking edges, PRs only with the `/pr` template and attached evidence (screenshots,
test output). CI gates: typecheck, lint, unit tests, build, Playwright smoke. Merge to `main`
only when green. GitHub Pages deploys from `main` via Actions; README carries the live link
and a representative screenshot.

### Q16 — Named risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Art reads as "programmer canvas" | Spend real time on the isometric renderer: shadows, roof gradients, banners, ambient particles; screenshot review each milestone. |
| Scope creep into a full tech tree | Fidelity floor from Q5 is a contract; extras only by displacing. |
| AI stalls or snowballs | Deterministic AI tests at 5/10/15 minutes; difficulty multipliers capped; watch match replays via debug fast-forward. |
| Pathfinding jank with crowds | Path cache + separation + stuck detection with repath; stress test 200 units. |
| Fog/minimap performance | 4 Hz visibility updates, precomputed tile centers, chunked terrain. |
| WebAudio blocked before gesture | Audio context created on first pointer/key event; mute persisted in localStorage. |

---

## Frontier status

Empty. Every branch has a settled decision. The next artifacts are the spec (GitHub issue),
the ticket graph (GitHub sub-issues with native blockers), and the agent environment docs.
