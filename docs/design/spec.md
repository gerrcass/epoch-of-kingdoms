# Spec — Epoch of Kingdoms

**Status:** ready-for-agent
**Tracker:** GitHub issue (this file is mirrored into the issue)
**Design tree:** `docs/design/grill-session.md`
**Glossary:** `GLOSSARY.md`

## Problem Statement

A player who wants the decision space of a classic RTS — villagers, drop-offs, ages, counters,
fog, a rival that plays — has to install a 20-year-old game or learn a competitive client. The
browser offers no credible single-match RTS that loads instantly, needs no account, and can be
linked to a friend. Existing browser homages are shallow base-builders: they show the theme but
not the decisions.

## Solution

Epoch of Kingdoms: a static browser RTS built with Vite, strict TypeScript, and Canvas 2D. A
single-player skirmish against an AI kingdom on a seeded 64×64 isometric map. The player gathers
four resources, builds a settlement, advances through three ages, trains a counter-based army,
scouts through fog of war, and destroys the enemy Town Center. The game is deployed to GitHub
Pages, tested at a headless command seam and a Playwright page seam, and presented with original
procedural art and audio.

## User Stories

1. As a new player, I want a title screen with a clear **Begin Campaign** action, so that I can start a match in one click.
2. As a new player, I want to pick one of three civilizations with a readable bonus, so that my first decision matters.
3. As a new player, I want three difficulty levels, so that the AI meets me where I am.
4. As a new player, I want an interactive help overlay listing every control, so that I can learn the vocabulary.
5. As a player, I want a seeded map so that I can replay a known battlefield or share a seed.
6. As a player, I want the camera to pan with WASD, the arrow keys, edge scrolling, and the minimap, so that navigating a large map feels natural.
7. As a player, I want the camera to zoom with the wheel, so that I can read both the settlement and the battlefield.
8. As a player, I want to left-click a unit or building and drag a selection box, so that I can command the right entity.
9. As a player, I want to shift-click to add to a selection and double-click to select all of a type on screen, so that group management is quick.
10. As a player, I want control groups Ctrl/Alt+1–9, so that my army and economy are always one keystroke away.
11. As a player, I want right-click to do the obvious contextual action — move, gather, attack, deposit, repair, or set a rally point — so that the game has no modal command soup.
12. As a player, I want an attack-move command and stop/hold commands, so that I can manoeuvre an army without micromanaging every unit.
13. As a player, I want aggressive, defensive, and stand-ground stances, so that units commit exactly as far as I intend.
14. As a player, I want villagers to gather food, wood, gold, and stone from finite map objects and carry loads to drop-off buildings, so that the economy is spatial.
15. As a player, I want a visible carry indicator and gathering animation, so that the economy is readable.
16. As a player, I want the resource bar to show food, wood, gold, stone, population, age, and match time, so that I can plan.
17. As a player, I want to place a building from a command card ghost that turns red on invalid ground, so that placement mistakes cost no resources.
18. As a player, I want villagers to construct the foundation over time and to resume construction automatically, so that building is an investment.
19. As a player, I want houses to raise population capacity and the game to explain why production is blocked, so that I learn the housing rule.
20. As a player, I want farms that villagers work for food and that must be renewed when exhausted, so that food has a footprint.
21. As a player, I want a Mill, Lumber Camp, and Mining Camp to shorten drop-off walks, so that expansion is worth the wood.
22. As a player, I want to advance from the Dark Age to Feudal and Castle at the Town Center, so that the match has a clock and a power spike.
23. As a player, I want technologies with clear stat changes and costs, so that I can invest in a plan.
24. As a player, I want to train villagers and six military unit types with distinct silhouettes and counters, so that composition is a decision.
25. As a player, I want production queues with progress, cancel, and rally points, so that I control where reinforcements go.
26. As a player, I want archers and towers to fire visible travelling arrows, so that ranged combat is legible.
27. As a player, I want melee and pierce armour plus bonus damage against cavalry, archers, and buildings, so that scouting pays.
28. As a player, I want health bars, selection rings, hit flashes, floating damage, and death effects, so that fights are readable at a glance.
29. As a player, I want the Town Center and Towers to defend themselves with arrows, so that an undefended dive is punished.
30. As a player, I want fog of war with visible, explored, and unknown tiles, and enemy units hidden outside vision, so that map information is a resource.
31. As a player, I want a minimap that shows terrain, entities, and fog, and that pans the camera when clicked, so that I can read the whole war.
32. As a player, I want an AI kingdom that gathers, builds, ages up, produces an army, scouts, and attacks in waves, so that the match has an opponent rather than a timer.
33. As a player, I want Easy, Normal, and Hard AI to differ in tempo without resource cheating on Normal, so that difficulty is honest.
34. As a player, I want clear notifications for age-ups, completed buildings, attacks, and missing resources, so that I never wonder what happened.
35. As a player, I want to pause, change game speed between 1×, 1.5×, and 2×, and resign, so that I control the session.
36. As a player, I want a victory or defeat overlay with match stats and a rematch button, so that the match has a clean ending.
37. As a player, I want a short contextual tutorial in the opening minutes, so that I am not lost in an unfamiliar genre.
38. As a player, I want procedurally synthesized audio with a mute control, so that feedback is immediate and no asset download is required.
39. As a player with reduced-motion sensitivity, I want a setting that disables screen shake, particles, and camera easing, so that I can play comfortably.
40. As a player, I want the HUD to remain usable on a 1280×720 laptop, so that I can play on ordinary hardware.
41. As a player, I want the game to hold 60 FPS with 200 units, so that commands feel immediate in a large fight.
42. As a player, I want the match to be playable offline after the first load, so that a flaky connection does not end the game.
43. As a developer, I want a deterministic world stepped by commands, so that a seed plus a command log reproduces a bug exactly.
44. As a developer, I want a headless simulation suite, so that economy, combat, AI, and victory are tested in milliseconds without a browser.
45. As a developer, I want a Playwright smoke test that boots the page, starts a match, commands a villager, builds, and trains a soldier, so that the integration seam is protected.
46. As a developer, I want a debug handle for tests that can fast-forward and snapshot the world, so that browser evidence is reliable.
47. As a reviewer, I want CI to run typecheck, lint, unit tests, build, and browser smoke, so that merges are gated by facts.
48. As a reviewer, I want every PR to carry before/after evidence with an attached screenshot, so that visual changes are judged, not assumed.
49. As a visitor, I want the README to show a representative screenshot and link the live GitHub Pages build, so that I can evaluate the game before cloning.
50. As a visitor, I want the game to load in under two seconds on a cold cache, so that trying it is frictionless.

## Implementation Decisions

### Runtime and architecture

- **Stack:** Vite + TypeScript strict; Canvas 2D world; DOM/CSS HUD; no runtime dependencies,
  no game engine, no backend. Static build deployed to GitHub Pages.
- **Simulation:** fixed 30 Hz tick; commands applied at tick boundaries; seeded mulberry32 PRNG;
  pure headless world importable in Node; rendering interpolates between ticks. This is ADR-0001.
- **Single command language:** `move`, `gather`, `build`, `repair`, `train`, `research`,
  `attack`, `attackMove`, `stop`, `hold`, `setStance`, `setRally`, `cancel`, `resign`. The human,
  the AI, and tests all issue commands; no layer mutates the world directly.
- **Renderer:** 2:1 isometric projection, 64×32 base tiles, 64×64 map; terrain pre-rendered in
  16×16-tile chunks; entities depth-sorted by `x + y`; procedural sprites generated at boot;
  cached full-map fog canvas. This is ADR-0002.
- **Deployment:** GitHub Actions builds and deploys `main` to Pages under
  `/epoch-of-kingdoms/`; all asset URLs respect Vite's `base`. This is ADR-0003.

### Match and content

- **Match:** one human kingdom, one AI kingdom, 64×64 symmetric generated map, conquest victory
  (destroy the enemy Town Center), resign, pause, 1×/1.5×/2× speed. Target 10–18 minutes at 1×.
- **Ages:** Dark → Feudal (500 food) → Castle (800 food, 200 gold), researched at the Town
  Center. Ages gate buildings, units, and technologies.
- **Resources:** food, wood, gold, stone. Start 200/200/100/100, 3 villagers, 1 Town Center.
- **Economy:** carry capacity 10; gather rates food 0.55/s, wood 0.6/s, gold 0.5/s, stone 0.45/s;
  finite nodes; farms are 300 food and must be rebuilt; Town Center +10 pop, House +5, cap 200.
- **Buildings:** Town Center, House, Mill, Lumber Camp, Mining Camp, Farm, Barracks, Archery
  Range, Stable, Blacksmith, Tower, Palisade Wall. Footprints from 1×1 to 3×3.
- **Units:** Villager, Militia, Spearman, Archer, Skirmisher, Scout, Knight, Battering Ram.
  Stats live in one frozen content table.
- **Combat:** melee and pierce armour; bonus vs cavalry, archers, buildings; cooldowns; aggro
  radius; travelling projectiles; buildings are valid targets; damage floor of 1.
- **Fog:** three-state per-tile visibility at 5 Hz; enemy entities hidden outside vision;
  explored terrain dimmed; buildings and units project vision; forests block renderer line of
  sight only.
- **Civilizations:** Aurelians (+15% farm food), Nordveld (+1 infantry attack), Kaldari (+1
  archer range). One passive each, surfaced on the title screen.
- **AI:** deterministic rule engine issuing the same commands as the human. Phase plan, villager
  targets, drop-off placement, house buffer, farm renewal, army composition, attack threshold,
  and defense response. Hard gets a 10% gather bonus; Normal and Easy do not cheat.
- **Tutorial:** contextual objective strip for the first match: train villagers, build a house,
  gather wood, reach Feudal, destroy the enemy Town Center.
- **Persistence:** civilization, difficulty, mute, reduced motion, and last seed stored in
  `localStorage`. No accounts, no telemetry.

### Presentation

- **Palette:** parchment and moss with brass accents; team colours deep blue and oxblood;
  readable silhouettes; contact shadows; roof gradients; banner cloth; drifting leaves and
  chimney smoke as ambient particles.
- **HUD:** top resource strip; bottom-left selection panel; bottom-centre minimap; bottom-right
  command card; objectives card; notification stack; modal title, pause, help, victory, defeat.
  Buttons are real `<button>` elements with hotkeys, costs, and disabled reasons.
- **Audio:** procedural WebAudio effects and a quiet generative lute bed, started on first
  gesture, with a mute toggle.

### Testing and quality

- **Primary seam:** the command boundary. `createWorld`, `issueCommand`, `tick`, state queries.
  Every gameplay feature arrives with a headless test here.
- **Page seam:** Playwright boots the built page, starts a deterministic match, commands a
  villager to gather, places and completes a house, trains a soldier, checks HUD/canvas, and
  captures `docs/media/game.png`.
- **Debug handle:** `window.__epoch` exposes `start`, `state`, `command`, `step`, `snapshot`,
  `testHook` for tests only. Gameplay code never reads it.
- **CI:** `npm run check` (typecheck, lint, unit tests), build, and Playwright smoke on every
  PR; Pages deploy from `main`.
- **Performance:** 60 FPS at 1080p with 200 units; bundle under 350 KB gzipped; no network
  requests after load.

## Testing Decisions

A good test asserts **external behaviour at a seam**, never a private helper or a pixel:
resources after a gather cycle, population after a house completes, an enemy's HP after a
counter attacks, victory after the last Town Center dies.

- **Simulation (Vitest):** determinism (same seed + command log ⇒ same state hash); map symmetry
  and starting positions; gather/carry/deposit and node depletion; building placement validity,
  cost, construction, population; training queues, rally, age and tech gating; combat armour,
  bonuses, projectiles, death, tower arrows; A* around buildings and water, unreachable targets,
  200-unit stress; fog states and vision; AI economy and first attack by its configured marks;
  victory, defeat, resign.
- **Browser (Playwright):** title → match; canvas paints; select villager → gather → wood
  increases; build house; train soldier; fast-forward; state assertions; screenshot; no console
  errors.
- **Prior art:** none yet in this repo; the harness and naming in this spec establish it.

## Out of Scope

Multiplayer/networking; campaigns; save/load; map editor; naval units and transport ships;
monks, conversions, relics; trade carts; formations and patrol; unique units and full per-civ
tech trees; cheat codes in the player UI; localization; touch controls; backend, accounts,
leaderboards; external art, fonts, or audio assets.

## Further Notes

- All names, art, and audio are original. The game borrows genre grammar, not assets or stat
  tables.
- The repo is a fresh initial commit; this spec and its tickets are the first work.
- A representative screenshot is required in the README and in the PR evidence.
