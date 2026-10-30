# Deterministic fixed-step simulation behind a command boundary

The match must be testable without a browser, reproducible from a seed, and drivable equally by
the human, the AI, and tests. We therefore run the world at a fixed 30 Hz tick, accept only
serialisable commands at tick boundaries, and source all randomness from a seeded PRNG. The
renderer samples interpolated state and never mutates the world.

**Consequences:** all gameplay files must be importable in Node without DOM access; no
`Math.random` or `Date.now` inside the simulation; new player actions must be expressible as
commands, not direct state edits. This is the reason the project can test economy, combat, AI
and victory in Vitest and fast-forward a whole match in milliseconds.
