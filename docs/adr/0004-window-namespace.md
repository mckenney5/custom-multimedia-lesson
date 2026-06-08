# Migrate from Global `window` Exports to ES Modules

All internal modules currently attach their public API to `window` (e.g., `window.state`, `window.ui`). This global namespace makes testing reliant on stubbing globals and hinders static analysis.

**Decision**: Convert the codebase to proper ES‑module syntax with explicit `export` and `import` statements. Preserve a minimal shim (e.g., `window.state = state`) only for the legacy entry point (`src/index.html`).

**Consequences**:
- Improves modularity and test isolation.
- Enables future bundling, tree‑shaking, or TypeScript migration.
- Requires updating all import sites and the HTML script tags to use `type="module"`.

**Browser compatibility impact**:
- **Modern browsers** (Chrome 61+, Edge 16+, Firefox 60+, Safari 11.1+) fully support native ES modules in script tags, so no change for the majority of active users.
- **Older browsers** (Internet Explorer, Safari 10 and earlier, older Android browsers) do **not** understand `type="module"`. Those users would see the script ignored, breaking the application entirely unless a fallback is provided.
- **Potential mitigations**:
  - Add a small build step (e.g., using Rollup or esbuild) that outputs an *UMD* bundle for legacy browsers while keeping the ES‑module source for modern ones.
  - Serve a conditional script tag that loads a transpiled bundle for browsers lacking module support (feature‑detect via `script[type="module"]`).
  - Keep the existing global shim as a fallback only for legacy environments, but this adds maintenance overhead.
- **Impact on testing**: Jest/Playwright environments already support modules, so no regression there.
