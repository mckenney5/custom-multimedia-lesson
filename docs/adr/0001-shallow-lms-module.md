# Remove or Enrich the Shallow LMS Module

The `lms.js` module currently acts as a thin pass‑through to `SCORM_API_wrapper.js`. It adds virtually no behaviour beyond forwarding calls, which violates the **depth** principle – the interface does not provide leverage.

**Context**: `state` uses `lms` for all SCORM interactions. The wrapper already contains the real implementation.

**Decision**: Replace the shallow `lms.js` with a richer module that encapsulates SCORM error handling, retry logic, and offline buffering. If the richer responsibilities are not required, merge the pass‑through directly into `state` and delete `lms.js`.

**Consequences**:
- Improves module depth and makes the seam meaningful.
- Centralises SCORM error handling, making future changes easier.
- Slightly increases `state`’s responsibilities if we merge; otherwise adds a dedicated `LMS` module with clear responsibilities.

*No further options were deemed necessary.*