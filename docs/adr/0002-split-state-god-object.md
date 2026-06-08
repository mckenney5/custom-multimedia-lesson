# Split the State God Object into Focused Modules

The `state.js` module currently aggregates responsibilities for loading lessons, navigation, security (nonce handling), theme management, UI callbacks, LMS persistence, and cross‑origin message routing. This monolithic design gives the module a very large interface, reducing leverage and locality.

**Decision**: Refactor `state.js` into a set of smaller, cohesive modules (e.g., `CourseLoader`, `Navigator`, `SecurityManager`, `ThemeManager`, `MessageRouter`). Each module will expose a narrow interface and be composed by a thin façade (`state`) that wires them together.

**Consequences**:
- Improves testability: each concern can be unit‑tested in isolation.
- Enhances locality: bugs or changes are confined to a single module.
- Slight increase in the number of files, but the overall architecture gains depth.
