# Introduce Per‑Page or Per‑Session Secrets Instead of a Single Lesson‑Wide Secret

`state.js` generates a single `pageAPISecret` at lesson start and uses it for all page‑level messaging. This creates a tight seam: rotating or revoking a secret requires a full lesson reload.

**Decision**: Implement a `SecretManager` that issues a fresh secret for each page load (or each session) and validates it on the receiving side. The secret can be stored in the page’s query string or in `state.data.delta`.

**Consequences**:
- Increases security; compromise of one page does not affect others.
- Enables future features such as temporary sharing links.
- Slightly more complex secret management but encapsulated in a dedicated module.

**Current implementation pros / cons**:
- **Pros**:
  - Simplicity: a single secret is generated once, no extra storage or coordination needed.
  - Low overhead: no per‑page lookup or regeneration logic, keeping the message‑validation path fast.
  - Easy to audit: only one place (`state.js`) to check for secret generation.
- **Cons**:
  - **Broad attack surface** – if the secret leaks (e.g., via console inspection or network sniffing) an attacker can forge messages for *any* page in the lesson.
  - **No rotation** – the secret cannot be refreshed without reloading the entire lesson, limiting mitigation options.
  - **Tight coupling** – the secret ties all pages together, making it harder to support scoped permissions (e.g., a page that should be view‑only).
  - **Future feature lock‑in** – implementing per‑page sharing or partial access would require a disruptive change.
