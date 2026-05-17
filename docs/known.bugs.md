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
