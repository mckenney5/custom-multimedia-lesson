# Known Bugs

## 31. Escape key does not exit fullscreen in headless Chromium Test

**File:** `src/internal/components.js:370` — `CourseVideo` fullscreen toggle
**Environment:** Playwright / headless Chromium
**Fix:** Waiting on an upstream fix in Playwright / Chromium — **cannot be fixed in this repo**. `document.exitFullscreen()` works programmatically as a workaround.

### Description

In headless Chromium, `element.requestFullscreen()` returns a promise that may resolve (entering a virtual fullscreen state), but the browser's built-in keyboard shortcut `Escape` does **not** trigger `document.exitFullscreen()` or fire the `fullscreenchange` event. This is a known limitation of headless mode — keyboard events dispatched via Playwright's `page.keyboard.press("Escape")` do not route through the browser's fullscreen-exit mechanism.

The fullscreen button's click handler (line 370) toggles between `requestFullscreen()` and `exitFullscreen()` based on `document.fullscreenElement`, which works correctly in headless. But the Escape shortcut bypasses this handler entirely.

### Impact

Any sequence that relies on Escape to exit fullscreen in headless tests will break. The `fullscreenchange` event count for `VIDEO_NORMAL_SCREEN` will be lower than expected (1 instead of 2 in a click-Escape-click-click sequence).

### Test Workaround

Avoid Escape for fullscreen exit; use 4 toggle clicks instead of click-Escape-click-click:
```
click → requestFullscreen → VIDEO_FULL_SCREEN
click → exitFullscreen    → VIDEO_NORMAL_SCREEN
click → requestFullscreen → VIDEO_FULL_SCREEN
click → exitFullscreen    → VIDEO_NORMAL_SCREEN
```

## 54. attemptsLeft is undefined until the first PROGRAMMING_DATA reply

**File:** `src/internal/components.js` — `CourseProgramming.execute()` attempts guard, `_handleProgrammingData` config fabrication
**Environment:** All (the window is a sub-millisecond postMessage round trip on page load)
**Fix:** **Decision: accept the window and document it** (kanban #54, option (a)); config fabrication hardened so the safety invariant is structural (config is only built from a config-bearing payload: `starterCode`/`language`/`testCases`). Full write-up with rejected alternatives in `docs/internal/programming-component.md` under "Known limitation: `attemptsLeft` is undefined until the first reply" (that file is git-ignored, hence this entry).

### Description

`CourseProgramming.attemptsLeft` is `undefined` from `connectedCallback()` until the first `PROGRAMMING_DATA` reply arrives, and `execute()`'s guard reads `undefined <= 0` as `false`, so during that window the guard alone would treat the component as unlimited.

### Why it is safe

1. **Every reply carries a numeric `attemptsLeft`** — both senders compute `(page.completionRules.attempts || Infinity) - attempts` in `state.js`, so the value is `Infinity` when the page has no attempts rule — numeric, never `undefined`; no reply path produces the unsafe value. The local decrement is `Number.isFinite`-guarded, so `Infinity` passes through untouched and `undefined` never becomes `NaN`.
2. **Config only comes from config-bearing payloads** — while `attemptsLeft` is `undefined`, `_componentConfig` is also missing, so `execute()` bails at the config-not-loaded gate before the sandbox is ever reached (`consumesAttempt: false`, "Component configuration not loaded yet" shown): **no learner code can execute in the window.** Before the hardening, *any* first matching message fabricated `_componentConfig` from defaults, so this rested on the accident that the config-less `CODE_EXECUTION` reply can never be a component's first message.

If no reply ever arrives the component is inert, not unlimited: config never loads, so every click takes the config-not-loaded path. Known causes: component id missing from page config; no matching `compState` (e.g. component `type` missing — skipped during `loadCourseData`); `page.completionRules` missing (the reply computation throws inside the un-wrapped `handleMessage`, so no reply is sent); reply sent but the `programming-data` listener was removed on disconnect (latent — kanban ticket #55).

### Rejected alternatives

- **state.js always replies (even when config/state is missing):** a config-less reply would fabricate `_componentConfig` from defaults (pre-hardening behavior), which **would enable runs with no grading criteria** — `_autograde` returns `total === 0` and `execute()` reports `completed = !error`, so any error-free run marks the component completed: unintended page completion, *worse than inert*. It would also contradict two existing no-reply tests and need a protocol addition.
- **Block runs while undefined:** strictly worse — early click becomes a silent no-op instead of the informative config-not-loaded message, and the `consumesAttempt: false` journal entry disappears, while the config gate it duplicates already prevents any run.

### Tests

`tests/files/components/programming-execute.test.js`: "a Run click before the first reply never executes learner code", "the first reply makes the attempts guard authoritative", "a reply with attempts remaining resumes runs and decrements locally", "a reply with no config fields does not enable runs". Reply-payload invariant (both senders always carry numeric `attemptsLeft`): "every PROGRAMMING_DATA reply carries a numeric attemptsLeft" in `tests/files/state/handleMessageGetProgrammingData.test.js`. State-side silence (no reply when component/config missing) is pinned by the two "should not send message" tests in that same file.
