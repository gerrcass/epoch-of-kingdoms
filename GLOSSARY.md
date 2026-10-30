# Glossary — Epoch of Kingdoms

The domain language of the project. Implementation details do not belong here.

## Match

**Kingdom** — one player's faction in a match: its resources, population, units, buildings,
vision, and age. Exactly two kingdoms exist: the human player's and the AI's.

**Match** — one skirmish from start to victory, defeat, or resignation. A match is identified
by its seed and difficulty.

**Skirmish** — a single match against the AI on a generated map. The only supported mode.

**Age** — a match-wide phase that gates buildings and units. The Dark Age is the starting
age; advancing to the Feudal Age costs food and time at the Town Center.

**Victory** — destroying the enemy Town Center. **Defeat** — losing your own Town Center, or
resigning.

## Map

**Tile** — one cell of the square simulation grid. The map is 64×64 tiles. Tiles are
classified as grass, dirt, forest, water, or buildable ground.

**Isometric projection** — the 2:1 diamond rendering of the square grid. Simulation
coordinates are always tiles; screen coordinates are a presentation concern.

**Resource node** — a depletable object on a tile: tree, gold vein, stone vein, or berry
bush. Each holds a finite amount of one resource.

**Fog of war** — the per-kingdom knowledge of the map, with three states: unseen, explored
(remembered but not currently observed), and visible.

**Vision** — the circular area a unit or building currently observes. Vision reveals enemy
entities and updates the fog.

## Economy

**Resource** — food, wood, gold, or stone.

**Villager** — the civilian unit. Gathers resources, constructs and repairs buildings, and
cannot fight effectively.

**Gathering** — a villager working a resource node: walking to it, extracting at a rate,
carrying up to a capacity, then returning the load to a drop-off.

**Drop-off** — a building that accepts carried resources. The Town Center accepts all four;
the Mill accepts food; the Lumber Camp accepts wood; the Mining Camp accepts gold and stone.

**Carry capacity** — the maximum load a villager can hold before returning to a drop-off.

**Farm** — a food building worked by a villager. It does not deplete; it is rebuilt when
exhausted.

**Population** — the number of population slots used by units, bounded by the population cap.

**Population cap** — the sum of supplied population from the Town Center and completed
Houses, hard-capped at 200.

**Build** — placing a building foundation and having villagers construct it. Construction
progresses with builder-seconds and completes when progress reaches the build time.

**Rally point** — the tile where a production building sends newly trained units.

## Military

**Unit** — a mobile entity. Military units are Militia, Spearman, Archer, Skirmisher, Scout,
and Knight. The Villager is a civilian unit.

**Building** — a static entity with a footprint, hit points, and a role: Town Center, House,
Mill, Lumber Camp, Mining Camp, Farm, Barracks, Archery Range, Stable, Blacksmith, or Tower.

**Attack** — the base damage a unit deals per strike, before armor.

**Armor** — melee and pierce mitigation, subtracted from incoming damage of the matching
type. Damage is never below one.

**Bonus damage** — extra damage against a tagged target class, such as spears against
cavalry.

**Counter** — the relationship in which a unit's bonuses make it efficient against another
unit class. Spears counter cavalry; skirmishers counter archers; cavalry counter
skirmishers and villagers.

**Projectile** — a travelling arrow with a launch point, target, and impact time. Ranged
units fire projectiles; melee units strike instantly.

**Aggro range** — the radius in which an idle military unit acquires a visible enemy.

**Stance** — a unit's standing order: aggressive (chase within range), defensive (engage
near its post), or stand ground (never leave its post).

**Attack-move** — an order to move toward a destination while engaging any enemy encountered.

## Presentation

**Command card** — the contextual grid of build, train, research, and order buttons for the
current selection, with hotkeys, costs, and disabled reasons.

**Minimap** — the corner overview of terrain, entities, and fog, clickable to move the camera.

**Selection panel** — the HUD area describing the current selection and its health, queue, or
gather status.

**Notification** — a short, queued HUD message such as "Not enough wood" or "Feudal Age
reached".

**Chunk** — a cached 16×16-tile terrain image used by the renderer to avoid redrawing static
ground every frame.
