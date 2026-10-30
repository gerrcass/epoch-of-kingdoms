# Static, client-only deployment on GitHub Pages

The whole game is a static Vite build: no server, no accounts, no telemetry. GitHub Pages
serves `main` through an Actions workflow, so the README's live link always tracks the merged
game. This keeps the operational surface at zero and makes the repo the only source of truth.

**Consequences:** all assets must be bundled or generated; no runtime secrets or APIs; the
Vite `base` must match the repository path. Tests that need a server use `vite preview`
locally, not a deployed backend.
