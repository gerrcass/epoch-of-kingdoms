# Canvas 2D isometric renderer with procedural art

We need the AoE2 silhouette — diamond ground, tall keeps, tiny people, banners — without
licensing art or shipping a heavy engine. We render a 2:1 isometric projection in Canvas 2D,
pre-render terrain into 16×16-tile chunks, and generate every sprite, building and sound
procedurally at startup from seeded shapes. No image, font or audio files are downloaded at
runtime.

**Consequences:** the art direction lives in code and must be reviewed visually, not through an
asset pipeline. WebGL and Three.js stay available if the 200-unit budget fails, but the
projection, depth sorting and simulation coordinates are engine-independent.
