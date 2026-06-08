# Replace Property‑Based UI Callbacks with an Event‑Emitter Interface

`ui.js` currently receives callbacks from `state` through private properties (`_onRefresh`, `_onReset`, `_onThemeChange`, `_onPrint`). This couples the UI directly to the internal shape of `state`, limiting reuse and making the seam fragile.

**Decision**: Introduce a lightweight event‑emitter API on `ui` (e.g., `ui.on(eventName, handler)` and `ui.emit(eventName, payload)`). `state` will subscribe to UI events instead of setting private properties.

**Consequences**:
- Decouples UI from `state` implementation details.
- Allows multiple listeners per event, enabling future extensions (e.g., analytics listeners).
- Slight refactor of existing UI code and test harnesses to use the emitter pattern.
