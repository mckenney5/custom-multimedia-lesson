# Design Specification: `src/internal/ui.js`

## Purpose

Singleton module owning all UI rendering for the course player. `ui` is a pure renderer — it never calls back into `state`. All data flows one direction: `state` → `ui`.

---

## Files

| Role | File |
|---|---|
| Module | `src/internal/ui.js` |
| State consumer | `src/internal/state.js` |
| Entry point | `src/index.html` |

---

## Ownership Boundaries

### `ui.js` owns (7 public properties, 1 private, 3 cached, 16 functions)

**Public properties** — queried in `ui.init()`:
| Property | Initial value | Description |
|---|---|---|
| `helpOverlay` | `null` | `document.getElementById("help-overlay")` — modal container |
| `helpContent` | `null` | `document.getElementById("help-content")` — modal body |
| `infoBanner` | `null` | `document.getElementById("info-banner")` — notification banner |
| `infoBar` | `null` | `document.getElementById("info-bar")` — progress bar |
| `isPaused` | `false` | "modal is open" guard flag; read by `state.startEventListeners()` to skip analytics |
| `lastActiveElement` | `null` | Focus restoration target when modal closes |

**Private property:**
| Property | Set by | Description |
|---|---|---|
| `_printData` | `showEndScreen()` | Cached print data for `printCertificate()` |

**Cached page data (populated by state):**
| Property | Populated by | Description |
|---|---|---|
| `_lastPage` | `state.init()` / `state.next()` / `state.prev()` | Current page config for `showPageHelp()` |
| `_lastPageDelta` | `state.init()` / `state.next()` / `state.prev()` | Current page delta for `showPageHelp()` |

**Callback properties (set by `state.init()`):**
| Property | Wired by | Used by |
|---|---|---|
| `_currentTheme` | `state.init()` | `toggleSettings()` default |
| `_onRefresh` | `state.init()` | Help menu "Refresh" button |
| `_onReset` | `state.init()` | Help menu "Reset" button |
| `_onThemeChange` | `state.init()` / `showSettingsMenu()` | Theme selector dropdown |
| `_onPrint` | `state.init()` / `showEndScreen()` | End screen "Print Certificate" button |
| `_onQuit` | `showEndScreen()` | End screen "Exit Course" button |

**Functions:**
| Function | Signature | Behavior |
|---|---|---|
| `init()` | `()` | Queries DOM for `help-overlay`, `help-content`, `info-banner`, `info-bar`. Wires banner click-to-dismiss. |
| `bannerMessage(text, isError)` | `(string, boolean)` | Shows notification banner with SVG icon + escaped message text. Sets `className` to `"error"` or `"warning"`. |
| `hideBanner()` | `()` | Hides banner via `display: none`. |
| `isBannerVisible()` | `() → boolean` | Returns `true` when banner `display` is `"flex"`. |
| `updateInfo(data)` | `({currentPageIndex, pageCount, progress})` | Renders progress bar fill width + "Page X of Y — Z% Complete" into `#info-bar`. Uses `Math.max(1, pageCount - 1)` to prevent divide-by-zero. |
| `toggleHelp()` | `()` | Toggles help modal: opens via `showHelpMenu()` or closes via `closeHelp()`. |
| `showHelpMenu()` | `()` | Saves `lastActiveElement`, sets `isPaused=true`, hides lesson frame, shows overlay, disables nav. Renders 4-button menu using stored `ui._onRefresh()` / `ui._onReset()` callbacks. Focuses close button. |
| `showPageHelp(page, pageDelta)` | `(object, object)` | Renders per-page completion requirements table with checkmarks. Caches `_lastPage`/`_lastPageDelta` when called with args. Falls back to cache when called from template without args. All interpolated values escaped via `utils.escapeHTML()`. |
| `showGeneralHelp()` | `()` | Renders `help.html` iframe + back button. |
| `closeHelp(lessonFrameEl)` | `(Element)` | Hides overlay, clears content, restores lesson frame, sets `isPaused=false`, re-enables nav, restores focus to `lastActiveElement`. |
| `closeHelpFrame()` | `()` | Convenience: queries `#lesson-frame` from DOM and calls `closeHelp()`. |
| `toggleSettings()` | `()` | Toggles settings modal. |
| `showSettingsMenu(currentTheme, {onThemeChange})` | `(string, {function})` | Renders theme selector dropdown. `onchange` fires `ui._onThemeChange(this.value)`. |
| `showEndScreen(hasPassed, scoreString, requiredScoreString, opts)` | `(bool, string, string, {onQuit, onPrint, printData})` | End-of-course modal. Renders pass/fail screen with score, optional certificate button (`onPrint`), review button, and exit button (`onQuit`). All strings escaped via `utils.escapeHTML()`. Caches `printData` in `_printData`. |
| `printCertificate()` | `()` | Renders certificate into `#certificate-print-area` using `_printData`. Uses `utils.escapeHTML()` + `utils.validateUrl()` for XSS prevention. Calls `window.print()`. |

---

### `state.js` retains

**Properties:**
```
lessonFrame, data (pages, delta, courseRules, log), studentName, studentID,
sessionStartTime, isIdle, focusTimer, pageAPISecret, currentTheme,
initialized, pauseSave, test, debugging, _seenNonces, _noncePruneTimer
```

**Functions:**
```
init, startEventListeners, serialize, deserialize, save, loadSave, reset,
loadCourseData, generatePasscode, handleMessage, sendMessage, _rejectNonce,
next, prev, advancePage, handleLastPage, finalizePage,
checkIfComplete, checkCourseCompletion, calculateOverallGrade,
setTheme, lockDown, quit, log, alert
```

**Note:** `setTheme` stays in state because it does both DOM mutation and iframe messaging. The settings menu calls `ui._onThemeChange(this.value)` which fires `state.setTheme(value)`.

---

## Data Flow

```
state.next() → ui.hideBanner()
             → ui.bannerMessage(text, isError)
             → ui.updateInfo({currentPageIndex, pageCount, progress})
             → ui._lastPage / ui._lastPageDelta  (set for help modal)

state.prev() → ui.hideBanner()
             → ui.bannerMessage(text, isError)
             → ui.updateInfo({currentPageIndex, pageCount, progress})
             → ui._lastPage / ui._lastPageDelta  (set for help modal)

state.startEventListeners()
  (Escape)   → ui.helpOverlay.style.display  (read)
             → ui.closeHelp(lessonFrame)
  (onBlur)   → ui.isPaused  (read)
  (timer)    → ui.isPaused  (read)

state.handleLastPage()
             → ui.showEndScreen(h, s, r, {onQuit, onPrint, printData})
             → (onQuit) → state.quit()
             → (onPrint) → ui.printCertificate()

ui._onRefresh()      → state.save() + location.reload()   (wired by state.init)
ui._onReset()        → state.reset()                       (wired by state.init)
ui._onThemeChange(v) → state.setTheme(v)                   (wired by state.init)
```

---

## Template String Cross-References

Inside generated HTML, event handlers use `ui.*` or stored callbacks:

| Template location | Handler | Resolves to |
|---|---|---|
| Help menu: Current Page | `ui.showPageHelp()` | `ui.showPageHelp()` |
| Help menu: General Help | `ui.showGeneralHelp()` | `ui.showGeneralHelp()` |
| Help menu: Refresh | `ui._onRefresh()` | `state.save()` + `location.reload()` |
| Help menu: Reset | `ui._onReset()` | `state.reset()` |
| Help menu: Back | `ui.showHelpMenu()` | `ui.showHelpMenu()` |
| Page help: Refresh Status | `ui.showPageHelp()` | `ui.showPageHelp()` |
| Page help: Back to Menu | `ui.showHelpMenu()` | `ui.showHelpMenu()` |
| General help: Back | `ui.showHelpMenu()` | `ui.showHelpMenu()` |
| Settings: Theme select | `ui._onThemeChange(this.value)` | `state.setTheme(value)` |
| End screen: Print Cert | `ui._onPrint()` | `ui.printCertificate()` |
| End screen: Review | `ui.closeHelpFrame()` | `ui.closeHelp()` |
| End screen: Exit | `ui._onQuit()` | `state.quit()` |
| Close button | `ui.closeHelpFrame()` | `ui.closeHelp()` |
| Index: Help button | `ui.toggleHelp()` | `ui.toggleHelp()` |
| Index: Settings button | `ui.toggleSettings()` | `ui.toggleSettings()` |

---

## Script Load Order

```html
<script src="internal/SCORM_API_wrapper.js"></script>
<script src="internal/lms.js"></script>
<script src="internal/journaler.js"></script>
<script src="internal/utils.js"></script>
<script src="internal/state.js"></script>
<script src="internal/ui.js"></script>      <!-- ← ui.js after state.js -->
```

---

## Init Sequence

```js
state.init(frameId) {
  lms.init();
  journaler.init(alert, lockDown);
  ui.init();                               // queries DOM, wires banner click

  this.lessonFrame = document.getElementById(frameId);
  // loadCourseData, loadSave, nonce setup...
  this.lessonFrame.src = ...;

  // Wire UI callbacks
  ui._currentTheme = "light";
  ui._onRefresh = () => { this.save(); location.reload(); };
  ui._onReset = () => this.reset();
  ui._onThemeChange = (value) => { this.setTheme(value); ui._currentTheme = value; };
  ui._onPrint = () => ui.printCertificate();

  this.startEventListeners();
  ui.updateInfo({currentPageIndex, pageCount, progress});  // initial paint

  // Cache page data for help modal
  ui._lastPage = this.data.pages[this.data.delta.currentPageIndex];
  ui._lastPageDelta = this.data.delta.pagesState[this.data.delta.currentPageIndex];

  this.initialized = true;
}

// startEventListeners() stays in state — wires keyboard, visibility,
// focus/blur, timer. Reads ui.isPaused, ui.helpOverlay, ui.infoBanner.
```

---

## Properties Removed from `state.js`

The following 6 properties moved from `state.js` to `ui.js`:

```
infoBanner  →  ui.infoBanner
infoBar     →  ui.infoBar
helpOverlay →  ui.helpOverlay
helpContent →  ui.helpContent
isPaused    →  ui.isPaused
lastActiveElement →  ui.lastActiveElement
```

---

## XSS Prevention

All functions that write to `innerHTML` use `utils.escapeHTML()` on interpolated values:

| Function | What is escaped |
|---|---|
| `bannerMessage` | `message` parameter |
| `showPageHelp` | All 5 requirement rows: `watchTime`, `score %`, `scrolled`, `videoProgress %`, `requireSubmission` |
| `showEndScreen` | `scoreString`, `requiredScoreString` |
| `printCertificate` | `titleText`, `bodyText` (before placeholder substitution), each placeholder value (`student`, `scoreString`, `dateString`, `totalMinutes`, `totalHours`, `minimumLength`), `logoUrl`, `signatureUrl`, `watermarkUrl` |

URLs in certificate images are double-validated: first via `utils.validateUrl()` (rejects `javascript:`, `data:`, protocol-relative), then `utils.escapeHTML()`.

---

## Test Coverage

Located in `tests/files/ui/` — ~85 test cases across 7 files:

| Test file | What it covers |
|---|---|
| `bannerMessage.test.js` | Error/warning CSS classes, icon rendering, HTML escaping, hide/show, role attributes |
| `updateInfo.test.js` | Progress bar width, page counter, edge cases (0%, 100%, single-page, multi-update) |
| `helpModal.test.js` | Open/close lifecycle, all 4 menu buttons, completion table rendering, iframe rendering, focus restoration, Escape key, no-arg `showPageHelp()` |
| `settingsModal.test.js` | Open/close, theme selector rendering, callback firing, focus restoration |
| `showEndScreen.test.js` | Pass/fail screens, cert button visibility, score display, XSS escaping (scores, titles, attribute-breaking payloads), `onPrint` callback, `onQuit` callback, `_printData` storage |
| `printCertificate.test.js` | Placeholder substitution, logo/signature/watermark inclusion rules, XSS prevention (URL injection, script injection, attribute breakout in all placeholders), `window.print()` call, NaN/zero edge cases |
| `regression.test.js` | Regression guards: `showPageHelp` without args (state-independent), `_onRefresh` save+reload, `showEndScreen` print callback wiring |
