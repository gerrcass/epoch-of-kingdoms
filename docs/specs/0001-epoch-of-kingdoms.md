# Epoch of Kingdoms — specification

## Problem Statement

A player wants the decision space of Age of Empires II — villager economy, drop-off
placement, ages, counters, scouting through fog, and a besieged Town Center — in a browser
tab. They do not want an install, an account, a tutorial campaign, or a storefront. Existing
browser homages either flatten the economy to one resource or stop at a base-builder with no
opponent worth beating. The game must load from a static URL in seconds and still feel like a
real skirmish by minute ten.

## Solution

A single-player browser RTS called **Epoch of Kingdoms**. A seeded 64×64 isometric map, a
human kingdom and an AI kingdom, three ages, four resources, eleven buildings, eight units,
five technologies, three civilizations, fog of war, a command card, a minimap, procedural art
and audio, and a conquest victory. One match: start with a Town Center and three villagers,
out-economy and out-fight the AI, destroy its Town Center. The whole game is a static Vite +
TypeScript build deployed to GitHub Pages.

## User Stories

1. As a player, I want to start a match from a title screen with difficulty, civilization, and
   seed controls, so that I can choose the kind of game I am about to play.
2. As a player, I want an isometric battlefield with terrain, forests, water, and mineral
   outcrops, so that the map is readable and worth scouting.
3. As a player, I want to pan with WASD, arrows, screen edges, and drag, and zoom with the wheel,
   so that I can move around the map without fighting the camera.
4. As a player, I want to select one unit, box-select many, shift-add, and double-click a type, so
   that commanding an army does not require precision clicking.
5. As a player, I want right-click to mean move, gather, attack, build, or deposit depending on
   what is under the cursor, so that the game feels direct.
6. As a player, I want an attack-move command, stop and hold commands, and control groups, so that
   I can manage a fight while my economy keeps running.
7. As a player, I want villagers to walk to a resource, gather at a visible rate, carry a load, and
   return it to the nearest valid drop-off, so that the economy has space and time in it.
8. As a player, I want berries, sheep, trees, gold, and stone to deplete, so that expansion and map
   control matter.
9. As a player, I want to place buildings with a ghost preview that shows footprint and validity,
   and have villagers construct them over time, so that base-building is a series of real choices.
10. As a player, I want houses to raise population capacity and the Town Center to train
    villagers, so that growing the economy has a cost and a rhythm.
11. As a player, I want a Mill, Lumber Camp, and Mining Camp to shorten return trips, so that
    drop-off placement is a decision.
12. As a player, I want farms that a villager works for food and that must be renewed, so that
    food has a spatial and wood cost.
13. As a player, I want the Dark, Feudal, and Castle ages to unlock buildings, units, and
    technologies, so that the match has a strategic clock.
14. As a player, I want a Barracks, Archery Range, Stable, Blacksmith, and Tower, each with a
    distinct role, so that my base reflects my plan.
15. As a player, I want Militia, Spearmen, Archers, Skirmishers, Scouts, Knights, and Battering
    Rams, so that army composition has counters and a siege answer.
16. As a player, I want spears to punish cavalry, skirmishers to punish archers, and rams to
    punish buildings, so that scouting the enemy composition changes my production.
17. As a player, I want projectiles to travel and hit, health bars to update, and units to die
    visibly, so that combat is legible.
18. As a player, I want my Town Center and Towers to shoot at attackers, so that diving my base
    has a cost.
19. As a player, I want five technologies with clear stat effects, so that spending resources on
    research is a real alternative to more units.
20. As a player, I want three civilizations with one readable bonus each, so that replaying the
    same map feels different.
21. As a player, I want fog of war with unexplored, explored, and visible tiles, so that scouting
    and map awareness are skills.
22. As a player, I want a minimap that shows terrain, my units, and enemy units in vision, so that
    I can command across the map.
23. As a player, I want a command card that changes with my selection and shows hotkeys, costs,
    and disabled reasons, so that I can learn the game by looking at it.
24. As a player, I want a production queue with progress and a rally point, so that reinforcing a
    fight is deliberate.
25. As a player, I want notifications for completed buildings, age-ups, attacks, and missing
    resources, so that I do not have to watch every corner of the map.
26. As a player, I want an AI that gathers, builds, ages up, produces, and attacks in waves, so
    that the match has an opponent rather than a target.
27. As a player, I want Easy, Normal, and Hard difficulties to change the AI's tempo without
    obvious cheating on Normal, so that the game meets me where I am.
28. As a player, I want victory when the enemy Town Center falls and defeat when mine does, with a
    summary and a rematch button, so that the match has a clean ending.
29. As a player, I want to pause, change speed, and resign, so that I control the session.
30. As a player, I want a match clock, age indicator, population count, and score, so that I can
    evaluate the state of the game at a glance.
31. As a player, I want procedural sound effects and a generative score with a mute control, so
    that the game has atmosphere without downloading assets.
32. As a player, I want a controls overlay and a short objectives panel, so that I can learn
    without leaving the game.
33. As a player, I want the interface to remain usable at 1280×720 and on touch-sized windows, so
    that I can play on a laptop.
34. As a player, I want reduced-motion and high-contrast options, so that the game is comfortable
    to use.
35. As a player, I want a stable frame rate with a few hundred units, so that my commands feel
    immediate.
36. As a developer, I want a deterministic simulation driven by commands and a seed, so that I
    can test and reproduce any match.
37. As a developer, I want a headless test suite that runs a full match in seconds, so that
    balance and AI changes are safe.
38. As a developer, I want a browser smoke test that proves boot → start → gather → build → train,
    so that integration regressions are caught.
39. As a maintainer, I want the game deployed from `main` to GitHub Pages with the README linking
    to it and showing a screenshot, so that the project is playable by anyone who finds the repo.
40. As a reviewer, I want PRs to carry a diagram, evidence, and a merge-danger note, so that I can
    judge changes quickly.

## Implementation Decisions

### Architecture

- **One deterministic world, one command boundary.** `src/sim` exports a factory that builds a
  match from `{ seed, difficulty, playerCiv, aiCiv }`, a command queue, a `tick` function, and
  read-only queries. The UI, AI, and tests all issue the same command objects. The simulation is
  pure TypeScript runnable in Node; no DOM, canvas, timers, `Math.random`, or `Date.now`.
- **Fixed tick and seeded RNG.** 30 ticks per second, mulberry32 seeded from the match seed, one
  PRNG stream for the world. Entity ids are monotonic. Iteration order is ascending id.
- **Layers.** `sim` (state and rules) → `render` (projection, sprites, fog, minimap) and `ui`
  (HUD, command card, input, menus). `main.ts` owns the loop and is the only place that wires
  layers. `render` and `ui` may read sim state; they never mutate it.
- **Test seam.** The primary seam is the command boundary in `src/sim`. One test file per system
  group, all using the same `createTestMatch()` helper: build world, push commands, step, assert
  observable state. The browser seam is the page, driven by Playwright with a `window.__epoch`
  debug handle that exposes start/command/fast-forward/state for setup and assertions.

### Simulation

- Map: 64×64 tiles, symmetric corner starts, a central water body or river, forests, gold/stone
  clusters, berries and sheep near each start. All generation seeded and mirrored.
- Economy: four resources; carry capacity 10; gather rates food 0.55/s, wood 0.6/s, gold 0.5/s,
  stone 0.45/s; drop-off filtering by resource; farms 300 food, one worker; depletion removes
  nodes; population cap 200, +5 per House, +10 per Town Center.
- Buildings: Town Center (3×3), House (1×1), Mill (2×2), Lumber Camp (1×1), Mining Camp (1×1),
  Farm (2×2), Barracks (2×2), Archery Range (2×2), Stable (2×2), Blacksmith (2×2), Tower (2×2).
  Each has cost, HP, armour, build time, footprint, age, drop-off mask, vision, and optional
  production/research list.
- Units: Villager, Militia, Spearman, Archer, Skirmisher, Scout, Knight, Battering Ram. Each has
  cost, train time, HP, attack, melee/pierce armour, range, cooldown, speed, vision, population,
  age, and bonus-damage tags.
- Ages: Dark → Feudal (500 food, 120 s) → Castle (800 food, 200 gold, 160 s), researched at the
  Town Center; buildings and units gate on age.
- Technologies: Loom, Wheelbarrow, Double-Bit Axe, Forging, Scale Mail. One research at a time per
  building; effects are kingdom-wide and apply to future units.
- Combat: auto-acquire in aggro range; melee instant, ranged projectile with travel time; damage
  = max(1, attack + bonus − armour); stances aggressive/defensive/stand-ground; attack-move;
  buildings auto-fire; rams have building bonus.
- Pathfinding: A* on the walkability grid, 8 neighbours without corner cutting, binary heap,
  per-tick expansion budget, path cache keyed by start/goal, ring-offset destinations for groups,
  local separation, stuck repath.
- Fog: per-kingdom visibility grid recomputed at 4 Hz from unit/building vision; three states.
  Enemy entities are omitted from render and from player-visible queries outside vision.
- AI: deterministic controller ticking at 2 Hz. Phase-based build order (open, feudal, pressure,
  siege), villager assignment by resource need, drop-off and house placement, army composition,
  attack waves, defense response, difficulty tempo. No resource cheats on Easy/Normal; Hard gets
  a small gather multiplier.
- Victory: enemy Town Center count reaches zero. Defeat: player Town Center count reaches zero or
  resign. The result is latched and stops the simulation.

### Presentation

- 2:1 isometric projection, 64×32 base tile, camera with pan/zoom, terrain prerendered into
  16×16-tile chunk canvases, depth-sorted entities, contact shadows, team-coloured sprites,
  animated water and banners, health bars, selection rings, floating combat text, particles.
- HUD in DOM/CSS: resource bar, age and clock, population, selection panel, command card,
  minimap, notifications, objectives, pause/victory/defeat overlays, title screen, settings.
- Procedural art and audio only; no external image, font, or sound files beyond the repo's
  original SVG icon. Audio starts on first gesture and is mutable.
- Responsive layout at 1280×720; the canvas fills the viewport and the HUD anchors to its edges.
- Accessibility: real buttons, hotkey labels, focus styles, reduced-motion mode, high-contrast
  toggle.

### Delivery

- Vite + TypeScript strict, no runtime dependencies. Vitest for sim tests, Playwright for browser
  tests and the README screenshot.
- GitHub Actions: `check` on PRs and `main`; deploy to Pages from `main` with the Vite base set to
  the repository path.
- Three tickets minimum? No: the ticket graph is the source of truth; one PR from the integration
  branch, merged to `main` after review and evidence.

## Testing Decisions

A good test exercises the game through its command boundary and asserts something a player could
observe: resources, entity counts, positions, health, visibility, victory. Tests do not reach into
private helpers or assert internal call order. Time advances by ticks, never by sleeps. Every test
is deterministic.

- **Headless simulation (Vitest, primary).** Grouped by system: map generation symmetry and
  resource placement; gather → carry → deposit → depletion; construction validity, cost,
  progress, population; production queues, rally points, age and tech gating; combat damage,
  armour, bonuses, projectiles, building fire; A* around obstacles and unreachable goals; fog
  transitions; AI economy by minute 5 and army by minute 10; victory/defeat; determinism hash
  over 1,000 ticks with mixed commands.
- **Browser (Playwright, secondary).** Title → New Game → HUD and canvas present → select a
  villager → right-click a tree → fast-forward → wood increases → open build menu → place a
  House → fast-forward → House exists → queue a Villager → fast-forward → population rises →
  screenshot at a staged, visually rich moment.
- **Visual review.** The renderer is reviewed from the screenshot at each milestone; palette,
  silhouette, font sizes, HUD crowding, and fog contrast are acceptance criteria for the
  presentation ticket.
- No prior art exists in this repo; the tests above establish the pattern.

## Out of Scope

Multiplayer and networking, campaigns, save/load, map editor, naval units, monks and relics,
trade carts, formations, patrol, unique units per civilization, a full AoE2 tech tree, mobile
touch controls, leaderboards, accounts, localization, and cheat codes in the shipped UI (the
debug handle is for tests only).

## Further Notes

- The user asked for a challenging objective; the fidelity floor is the contract. Extras must
  displace an in-scope feature, not append to it.
- The game is original work: no Age of Empires assets, names, audio, or UI are copied. "Epoch of
  Kingdoms", its civilizations, and its art are original.
- The README must carry the live Pages URL and a representative screenshot generated by the
  browser test; the deployment workflow is part of the definition of done.
