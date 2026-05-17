# Known Bugs

## 1. `currentPageIndex` off-by-one after save/load cycle

**File:** `src/internal/state.js` — `serialize()` and `deserialize()`
**Fix:** None yet; root cause unclear.

### Description

When `state.save()` is called with `currentPageIndex = 3` (user is on finish.html, the fourth page), the subsequent `loadSave()` restores it as `2`. The basic metrics array (`progress`, `completed[]` flags, per-page scores/times) round-trips correctly, but the first element of the serialized delta — `currentPageIndex` — is consistently off by -1.

The data path is:

```
serialize() → [currentPageIndex, progress, totalCourseSeconds, …pageData]
  → journaler.pack() → joins with delimiter '^', encodes numbers in Base36
  → lms.saveData() → localStorage
  → lms.loadData() → journaler.unpack() → splits by '^', decodes Base36
  → deserialize() → arr[0] = currentPageIndex
```

Other globals (`progress`, `totalCourseSeconds`) restore correctly, which suggests the delta array structure is correct but element 0 is somehow corrupted. Candidates:

- `_toBase36(3)` returns `"3"`, `_fromBase36("3")` returns `3` — no issue in isolation.
- The `pack()` function spreads `...deltaArray` after encoding. If `eventBuffer` or log data leaks into the delta portion of the packed string, the offsets would shift.
- The `unpack()` function splits by `^` and slices `parts.slice(3, parts.length - 1)` for delta. If any delta value (especially the complex JSON strings) contains `^` (despite sanitize), the split would produce wrong part boundaries.

### Impact

Any code that relies on `currentPageIndex` after a page reload (refresh, LMS resume, etc.) will see the wrong page. Navigation via `state.next()` and `state.prev()` will work from the wrong position.

### Test Workaround

The e2e test detects the discrepancy after refresh and, if `currentPageIndex === 2` instead of `3`, clicks `#next` to re-advance to page 3 before proceeding.

---

## 2. Quiz button text reset to "Submit Answers" on page re-load

**File:** `src/internal/components.js:882-898` — `CourseQuiz.renderForm()`
**Fix:** Check `this.hasAttempted` when creating the submit button and set text to `"Submitted"` (with `disabled = true`) if the quiz was previously submitted.

### Description

`CourseQuiz.renderForm()` unconditionally creates the submit button with `btn.textContent = "Submit Answers"` (line 884). It never checks `this.hasAttempted` or `this.attemptsLeft` to reflect a previously-submitted state.

The only code path that sets `btn.textContent = "Submitted"` is in `submit()` (line 954), which runs when the user clicks submit in the current session. On page re-load — e.g., navigating `#prev` back to a page after a refresh — `handleQuizData()` receives the saved quiz data (including `hasAttempted: true`), calls `renderForm()`, which creates a fresh button with `"Submit Answers"`.

The quiz **state is correctly preserved** — answers are pre-filled, score feedback shows, completed flag is true. Only the button text is misleading.

### Impact

Users returning to a previously-submitted quiz see "Submit Answers" and may attempt to re-submit, consuming attempts. Test assertions that check for `"Submitted"` on the button will fail on page re-load.

---

## 3. Escape key does not exit fullscreen in headless Chromium

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
