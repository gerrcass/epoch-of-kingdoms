# Grill with docs — Epoch of Kingdoms

**Date:** 2026-10-30
**Facilitator:** agent (self-interview; the user asked for the recommended answer to be adopted at every branch)
**Outcome:** adopted decisions for a browser RTS in the lineage of Age of Empires II.

The interview works a design tree in rounds. Each question below is followed by the answer that was adopted, with the reasoning that survived the grilling. Issues that were settled in an earlier round are not re-opened.

---

## Round 1 — What are we building?

### Q1. What does "Age of Empires II clone" mean here?

Options: (a) a campaign of scripted missions, (b) a faithful data clone of the full tech tree, (c) a complete single-match RTS loop — economy, construction, army, fog, AI, victory — with original art and names.

**A (adopted): (c).** A clone is a game that produces the same *kind* of decisions: spend villagers on food or wood, place a lumber camp or a farm, age up or make militia, scout the fog, commit to a fight. Campaigns and the full 40-civilization tech tree are content, not the core. We build one excellent skirmish.

### Q2. What is the platform and runtime?

Options: (a) desktop native engine, (b) Unity/Godot WebGL build, (c) a static TypeScript application rendered with Canvas 2D, (d) a React app with a game library.

**A (adopted): (c).** Vite + strict TypeScript, no runtime framework, no game engine, no backend. Canvas 2D with a DOM HUD. It deploys as static files to GitHub Pages, loads in under two seconds, and keeps the simulation testable in Node. Skipping an engine is deliberate: the interesting part is the simulation and the isometric presentation, and both are small enough to own.

### Q3. What is the visual target?

Options: (a) 3D models, (b) sprite-sheet pixel art from an asset pack, (c) procedurally drawn isometric art with a painterly pixel aesthetic, (d) abstract shapes.

**A (adopted): (c).** 2:1 isometric tiles, a 64×64 map, warm grass and deep forest, chunky buildings with readable silhouettes, tiny soldiers with team-coloured shields, and a parchment-and-moss interface. Every sprite is generated at boot by code, so there are no asset downloads, no licensing questions, and the game stays a single small bundle. The target is "a screenshot you would put on a store page", not photorealism.

### Q4. What is the shape of a match?

Options: (a) 1v1 against a scripted AI, (b) wave survival, (c) 4-player free-for-all.

**A (adopted): (a).** One human kingdom versus one AI kingdom on a symmetric map. Three difficulty levels, three civilizations, three ages, a conquest victory (destroy the enemy Town Center), a resign option, pause and 1×/1.5×/2× speed. A match should resolve in 10–18 minutes at 1×.

### Q5. How close to the source material should names and art be?

Options: (a) use Age of Empires names and assets, (b) evoke the genre with entirely original names and art.

**A (adopted): (b).** "Epoch of Kingdoms" is an original game. Civilizations, unit names where they are generic (Villager, Archer, Knight), building names where they are generic (Town Center, Barracks), and all art and audio are original. No ripped assets, no copied UI, no trademarked civilization names.

---

## Round 2 — What are the systems?

### Q6. How deep is the economy?

Options: (a) one resource, (b) four resources with instant gathering, (c) four resources with carry capacity, drop-off buildings, finite nodes, farms, and a population cap.

**A (adopted): (c).** Food, wood, gold, stone. Villagers carry 10, walk to a drop-off, and return. Berries, sheep, trees, gold, and stone are finite; farms are renewable but must be rebuilt. Houses raise the population cap. This is the minimum economy that makes map control and expansion meaningful.

### Q7. How deep is combat?

Options: (a) attack-move only, (b) a counter triangle, (c) attack/armour types, bonus damage, projectiles, stances, formations.

**A (adopted): (b) plus projectiles and three stances, not formations.** Melee and pierce armour; spears bonus against cavalry; skirmishers bonus against archers; rams bonus against buildings. Archers and towers fire travelling arrows. Units support aggressive, defensive, and stand-ground stances. Formations and patrol are out.

### Q8. What makes the AI credible without cheating?

Options: (a) scripted waves on a timer, (b) a utility economy that plays the same systems as the human, (c) a neural net.

**A (adopted): (b).** The AI issues the same commands through the same queue. It maintains a villager target, assigns idle villagers by need, builds drop-offs and houses, ages up, produces a composition, and attacks when its army crosses a threshold. Difficulty changes its reaction cadence, army threshold, and (on Hard only) a modest gather bonus. Deterministic: the same seed and difficulty produce the same match.

### Q9. Fog of war?

Options: (a) none, (b) visible/unknown with a hard edge, (c) visible/explored/unknown with per-tile vision from units and buildings.

**A (adopted): (c).** Three states, vision radii, explored terrain remembered but dimmed, enemy units hidden outside vision. Buildings and forests block renderer line of sight for atmosphere, but not simulation line of sight — a deliberate simplification recorded in the ADR.

### Q10. Controls and HUD?

Options: (a) mouse only, (b) classic RTS bindings with a command card, (c) a simplified mobile layout.

**A (adopted): (b).** Left-click select, drag box-select, shift-add, right-click contextual command, control groups, idle-villager cycling, attack-move, stop, hold, build menu, rally points, minimap click/drag, camera pan and zoom, and a command card with hotkeys and tooltips. A responsive fallback keeps the game usable on a small laptop; touch is out of scope.

### Q11. What is the win condition?

Options: (a) destroy every enemy building, (b) destroy the enemy Town Center, (c) score after a timer.

**A (adopted): (b).** Conquest: the first kingdom to lose its last Town Center loses. A countdown overlay appears when a Town Center falls below 25% health. Resign is always available. There is no wonder or relic victory in this scope.

---

## Round 3 — How is it engineered?

### Q12. What is the simulation architecture?

Options: (a) mutate state directly from input handlers, (b) an ECS framework, (c) a fixed-tick world with a command queue and seeded RNG.

**A (adopted): (c).** The world is a plain data structure stepped at 30 Hz. The human, the AI, and tests all speak one command language. Randomness comes from a seeded PRNG. Rendering reads the world but never mutates it. This gives determinism, replayable tests, and a clean seam for headless simulation.

### Q13. Pathfinding and movement?

Options: (a) straight-line movement, (b) a navigation mesh, (c) A* on the tile grid with local separation.

**A (adopted): (c).** A* on a 64×64 grid, 8-directional, with corner-cutting prevention and a node budget per tick. Groups receive nearby destination offsets so they do not stack. Units apply light separation to neighbours. Paths are requested through a budgeted queue so 200 units do not stall a frame.

### Q14. Performance budget?

**A (adopted):** 60 FPS at 1920×1080 with 200 units and 600 map objects on a 2020-class laptop; first interactive paint under 2 s on a cold cache; JS bundle under 350 KB gzipped. The renderer culls to the viewport, terrain chunks are pre-rendered, and the fog layer is a cached full-map canvas updated only when vision changes.

### Q15. How is it tested?

Options: (a) manual play only, (b) unit tests on internals, (c) headless simulation tests at the command boundary plus browser smoke tests at the page boundary.

**A (adopted): (c).** The primary seam is the command boundary: build a world from a seed, issue commands, step ticks, assert outcomes. That covers economy, construction, combat, pathfinding, AI, fog, and victory. Playwright covers the page boundary: boot, start a match, select and command, see the HUD update, and take the README screenshot. One seam, two altitudes.

### Q16. Deployment and quality gates?

**A (adopted):** GitHub Actions runs typecheck, lint, unit tests, build, and Playwright smoke on every PR. `main` deploys to GitHub Pages. Every PR carries before/after evidence (screenshots or command output) uploaded with `gh pr comment --attach` (the `pr` skill's evidence rule), and merges only when checks are green. The README carries the live link and a representative screenshot.

---

## Round 4 — What could sink it?

### Q17. The three biggest risks?

1. **Scope.** Mitigation: the ticket graph is vertical slices; every slice is playable; naval, monks, trade, campaigns, and multiplayer are explicitly out.
2. **Art quality.** Procedural art can read as "programmer art". Mitigation: a deliberate palette, silhouette-first building design, anisotropic ground texture, contact shadows, team colour, and a screenshot review gate before the PR.
3. **AI competence and pathing jank.** Mitigation: the AI uses the same commands as the human and is tested headlessly over a full match; pathing has a budget and a fallback to straight-line steering when A* fails, plus a stress test with 200 units.

### Q18. What is explicitly out of scope?

Multiplayer and networking, campaigns, save/load, map editor, naval units, monks and conversions, trade carts, formations, patrol, unique units per civilization, cheat codes in the shipped UI (a hidden test hook is allowed), localization, touch controls, and a full AoE2 tech tree.

---

## Shared understanding

The frontier is empty. Every branch above is settled, the vocabulary is captured in `GLOSSARY.md`, and the irreversible choices are recorded in `docs/adr/`. The spec and tickets follow.
