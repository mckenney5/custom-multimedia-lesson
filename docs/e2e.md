# End-to-End Test Design

## Overview

E2E tests walk through the full course as a real user would — scrolling articles, answering quizzes, playing videos, navigating pages, and verifying end-screen outcomes. Three scenarios: passing (100%), failing (28.6%), and barely-passing (71.4%) with comprehensive interaction coverage.

Tests use Playwright with real user interactions (`.click()`, `.fill()`, smooth scroll). No `page.evaluate()` shortcuts for state manipulation. Video plays for real. WatchTime waits are handled by waiting for the completion banner rather than fixed timeouts.

## File Layout

```
tests/
  helpers/
    e2e-setup.js        # Shared setup: clear storage, navigate, wait for init
  files/
    e2e/
      pass.test.js       # 100% score, "passed" end screen
      fail.test.js       # 28.6% score, "failed" end screen
      barely-pass.test.js # 71.4% score, full interaction coverage
```

## Core Principles

1. **Real interactions** — click radio buttons, type into inputs, scroll to bottom, click submit. No `.check()` or `.dispatchEvent()`.
2. **Banner-driven timing** — every page waits for `#info-banner.warning` (the "This page is completed" banner) before clicking next, rather than hard-coded timeouts.
3. **Iframe targeting** — all child page interactions go through `page.frameLocator('#lesson-frame')`.
4. **Vertical slices** — each slice delivers a working, independently runnable test slice that builds on the previous.

## Reusable Helper: `tests/helpers/e2e-setup.js`

```js
async function setupE2EPage(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('http://localhost:8080/');
  await page.waitForFunction(() =>
    typeof state !== 'undefined' && state.initialized
  );
  return page;
}
```

Note: `barely-pass.test.js` does NOT use this helper because it needs to survive a page refresh (to test save/load persistence). `setupE2EPage` clears `localStorage` unconditionally on every navigation, which would wipe saved state after a refresh. Instead, barely-pass uses its own `addInitScript` that clears `localStorage` only on the first load (using `sessionStorage._cleared` as a persistent flag).

## Answer Maps

### Pass Test (100% = 7/7)

| Quiz | Q | Type | Answer | Pts |
|------|---|------|--------|-----|
| quiz1 | Q1 | multiple-choice "The sky is blue" | click radio **"True"** | 1 |
| quiz1 | Q2 | short-answer "What is 3 + 1" | type **"4"** | 1 |
| quiz2 | Q3 | select-all "warm colors" | click **"red"**, **"orange"**, **"yellow"** | 1 |
| quiz2 | Q4 | multiple-choice "Epi Pen dose" | click radio **"0.3mg"** | 0.5 |
| quiz3 | Q5 | multiple-choice "The sky is red" | click radio **"False"** | 1 |
| quiz3 | Q6 | multiple-choice "What is 1 + 1" | click radio **"2"** | 1 |
| quiz4 | Q7 | select-all "warm colors" | click **"red"**, **"orange"**, **"yellow"** | 1 |
| quiz4 | Q8 | select-all "Epi Pen doses" | click **"0.3mg"**, **"0.15mg"** | 0.5 |

### Fail Test (28.6% = 2/7)

| Quiz | Q | Type | Answer | Pts |
|------|---|------|--------|-----|
| quiz1 | Q1 | multiple-choice "The sky is blue" | click radio **"True"** | 1 |
| quiz1 | Q2 | short-answer "What is 3 + 1" | type **"5"** | 0 |
| quiz2 | Q3 | select-all "warm colors" | click **"blue"** only | 0 |
| quiz2 | Q4 | multiple-choice "Epi Pen dose" | click radio **"0.15mg"** | 0 |
| quiz3 | Q5 | multiple-choice "The sky is red" | click radio **"False"** | 1 |
| quiz3 | Q6 | multiple-choice "What is 1 + 1" | click radio **"3"** | 0 |
| quiz4 | Q7 | select-all "warm colors" | click **"blue"** only | 0 |
| quiz4 | Q8 | select-all "Epi Pen doses" | click **"1mg"**, **"0.4g"** | 0 |

### Barely-Pass Test (71.4% = 5/7)

**Strategy:** Miss Q1 and Q3 (both 1pt) on page 1. Get everything else right.

| Quiz | Q | Type | Answer | Pts |
|------|---|------|--------|-----|
| quiz1 | Q1 | multiple-choice "The sky is blue" | click radio **"False"** | 0 |
| quiz1 | Q2 | short-answer "What is 3 + 1" | type **"4"** | 1 |
| quiz2 | Q3 | select-all "warm colors" | click **"blue"** only | 0 |
| quiz2 | Q4 | multiple-choice "Epi Pen dose" | click radio **"0.3mg"** | 0.5 |
| quiz3 | Q5 | multiple-choice "The sky is red" | click radio **"False"** | 1 |
| quiz3 | Q6 | multiple-choice "What is 1 + 1" | click radio **"2"** | 1 |
| quiz4 | Q7 | select-all "warm colors" | click **"red"**, **"orange"**, **"yellow"** | 1 |
| quiz4 | Q8 | select-all "Epi Pen doses" | click **"0.3mg"**, **"0.15mg"** | 0.5 |

**Per-page score check:**
- Page 1: 1.5/3.5 = 42.8% ≥ 10% ✓
- Page 2: 3.5/3.5 = 100% ≥ 10% ✓
- Total: 5/7 = 71.4% ≥ 70% ✓

## Page-by-Page Walkthrough

### Page 0 — `directions.html`

**Requirements:** watchTime >= 2s, scrolled = true

**Steps:**
1. Wait for iframe H1 "Lesson Directions"
2. Smooth-scroll to bottom via `window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })`
3. Wait for `#info-banner.warning` banner
4. Click `#next` in parent frame
5. Wait for next page H1 in iframe

### Page 1 — `multi_example.html`

**Requirements:** score >= 0.10 (10%), requireSubmission = true

**Pass steps:**
1. Wait for iframe H1 "Page 1"
2. Within `course-quiz#quiz1`: click radio Q1="True", fill text input Q2_text with "4"
3. Click `course-quiz#quiz1 .btn-submit`
4. Within `course-quiz#quiz2`: click radio Q3="red", "orange", "yellow"; click radio Q4="0.3mg"
5. Click `course-quiz#quiz2 .btn-submit`
6. Wait for `#info-banner.warning`
7. Click `#next`

**Fail steps:**
1. Wait for iframe H1 "Page 1"
2. Within `course-quiz#quiz1`: click radio Q1="True", fill Q2_text with "5", click submit
3. Within `course-quiz#quiz2`: click radio Q3="blue", click radio Q4="0.15mg", click submit
4. Wait for `#info-banner.warning`
5. Click `#next`

**Barely-pass steps:**
1. Wait for iframe H1 "Page 1"
2. Quiz1: Q1="False" (wrong), Q2="4" (right), click `.btn-submit`
3. Dispatch `blur` on `window` → wait 200ms → `CLICK_OFF` logged
4. Dispatch `focus` on `window` → `CLICK_BACK` logged
5. Quiz2: Q3="blue" only (wrong), Q4="0.3mg" (right), click `.btn-submit`
6. Wait for `#info-banner.warning`
7. Click `#next`

Note: Anti-cheat events (contextmenu/copy) are not fired on page 1 because both quiz1 and quiz2 have `disable-anticheat` in course_data.json. Anti-cheat coverage is achieved via quiz3 on page 2 (no `disable-anticheat`).

### Page 2 — `multi_example2.html`

**Requirements:** watchTime >= 10s, score >= 0.10, videoProgress >= 0.10

**Pass steps:**
1. Wait for iframe H1 "Page 4"
2. Click `#play-pause` to start video (plays in background while we answer quizzes)
3. Within `course-quiz#quiz3`: click radio Q5="False", click radio Q6="2", click submit
4. Within `course-quiz#quiz4`: click radio Q7="red", "orange", "yellow"; click radio Q7="0.3mg", "0.15mg"; click submit
5. Wait for `#info-banner.warning` (fires when 10s watchTime AND 10% videoProgress are both met)
6. Click `#next`

**Fail steps:**
1. Wait for iframe H1 "Page 4"
2. Click `#play-pause` to start video
3. Within `course-quiz#quiz3`: click radio Q5="False", click radio Q6="3", click submit
4. Within `course-quiz#quiz4`: click radio Q7="blue", click radio Q7="1mg", "0.4g"; click submit
5. Wait for `#info-banner.warning`
6. Click `#next`

**Barely-pass steps:**
1. Wait for iframe H1 "Page 4"
2. Click `#play-pause` to start video
3. Quiz3: Q5="False", Q6="2", TTS button, anti-cheat contextmenu, submit
4. Help modal: Current Page table → Back to Menu → General Help iframe → Back to Menu → Close
5. Quiz4: Q7="red","orange","yellow", Q8="0.3mg","0.15mg", submit
6. Video controls: forward, speed 2x, mute, fullscreen (try/catch 4-click workaround)
7. Pause via click, resume via Space key
8. Focus/blur: blur → 200ms → focus
9. Wait for `#info-banner.warning`
10. Click `#next`

### Page 3 — `finish.html`

**Requirements:** watchTime >= 2s

**Steps:**
1. Wait for iframe H1 "Congrats!"
2. Wait for `#info-banner.warning`
3. Click `#next` — triggers `state.handleLastPage()` which calls `ui.showEndScreen()`
4. Wait for `#help-overlay` to be visible

**Barely-pass steps:**
1. Wait for iframe H1 "Congrats!"
2. Settings: open → dark → close; open → light → close
3. Help → Current Page table → Back → Refresh This Web Page
4. Wait for state re-initialization after reload
5. Detect off-by-one bug (ticket 26): if currentPageIndex === 2, click next to advance
6. Click prev → verify page 2 quiz states preserved
7. Click next → back on finish page
8. Wait for `#info-banner.warning`
9. Wait for minimumMinutes timer if needed
10. Click `#next` → triggers end screen

### End Screen

**Pass assertions:**
- `#help-overlay` has `display: flex`
- `#help-content` contains "Course Completed"
- `#help-content` contains the score percentage
- A button with "Print Certificate" text is present
- Clicking Print Certificate populates `#certificate-print-area` with student name and score

**Fail assertions:**
- `#help-overlay` has `display: flex`
- `#help-content` contains "Course Incomplete"
- `#help-content` contains the score percentage
- `#help-content` contains "70%" (the required minimum)
- No "Print Certificate" button exists

## Barely-Pass Test: Full Interaction Catalog

### Interaction Coverage

| Category | Interactions | Page |
|----------|-------------|------|
| **Article** | Scroll, visibility change (hidden/visible) | 0 |
| **Quiz** | Radio, checkbox, text-input, submit, TTS button, shuffle verification | 1, 2 |
| **Anti-cheat** | Right-click, copy | 2 |
| **Focus/blur** | CLICK_OFF, CLICK_BACK | 1, 2 |
| **Help modal** | Page help table, General help iframe, Back to Menu, Close | 2, 3 |
| **Settings** | Open, theme change, close | 3 |
| **Refresh** | Save + reload, verify state persisted | 3 → 2 → 3 |
| **Reset** | Help → Reset → confirm → verify fresh state | end |
| **Video** | Play, pause, forward, speed change (2x), mute, fullscreen | 2 |
| **Video keyboard** | Space (play/pause), ArrowRight (forward), M (mute) | 2 |

### Full Flow

#### Step: page 0 — directions (scroll + visibility)

1. Wait for iframe H1 "Lesson Directions"
2. Smooth scroll to bottom
3. Override `document.hidden` via `Object.defineProperty` → dispatch `visibilitychange` → `VISIBILITY_HIDDEN` logged
4. Restore `document.hidden` → dispatch `visibilitychange` → `VISIBILITY_VISIBLE` logged
5. Wait for `#info-banner.warning`
6. Click `#next`

#### Step: page 1 — multi_example (quizzes + focus/blur)

1. Wait for iframe H1 "Page 1"
2. Quiz1: Q1="False" (wrong), Q2="4" (right), click `.btn-submit`
3. Dispatch `blur` on `window` → wait 200ms → `CLICK_OFF` logged
4. Dispatch `focus` on `window` → `CLICK_BACK` logged
5. Quiz2: Q3="blue" only (wrong), Q4="0.3mg" (right), click `.btn-submit`
6. Wait for `#info-banner.warning`
7. Click `#next`

Note: Anti-cheat events are not fired on page 1. Both quiz1 and quiz2 have `disable-anticheat`, so contextmenu/copy would produce no SUSPICIOUS_ACTION. Anti-cheat coverage is on page 2 where quiz3 has anti-cheat enabled.

#### Step: page 2 — multi_example2 (video + help table + all interactions)

1. Wait for iframe H1 "Page 4"
2. Click `#play-pause` to start video

**Quiz3 interactions:**
3. Answer Q5="False", Q6="2"
4. Click TTS button on quiz3 Q5 → exercises `speechSynthesis.speak()` (no audio assertion)
5. Fire `contextmenu` on quiz3 `.quiz-container` → `SUSPICIOUS_ACTION`
6. Click `.btn-submit` on quiz3

**Help modal on page 2:**
7. Click `#help-btn`
8. Click "Help with Current Page" → verify completion table shows partial progress:
   - "Minimum Score" row present (should be completed after quiz3 submission)
   - "Watch Video" row present (should show not yet completed)
9. Click "Back to Menu"
10. Click "General Course Help" → verify help iframe loads
11. Click "Back to Menu"
12. Click `#close-help` → help closes

**Quiz4 + remaining video:**
13. Quiz4: Q7="red","orange","yellow", Q8="0.3mg","0.15mg", click `.btn-submit`
14. Click `#forward` → seek +5s → `VIDEO_FORWARD`
15. Change `#speed-select` to "2" → `VIDEO_SPEED_CHANGE`
16. Click `#mute-btn` → `VIDEO_MUTED`
17. Fullscreen (wrapped in try/catch):
    - Click `#full-screen` → if successful, `VIDEO_FULL_SCREEN`
    - Press `Escape` → `VIDEO_NORMAL_SCREEN`
    - Click `#full-screen` again → `VIDEO_FULL_SCREEN`
    - Click `#full-screen` again → `VIDEO_NORMAL_SCREEN`
    - If fullscreen fails at any point: `console.warn` but don't fail test
18. Click `#play-pause` to pause → `VIDEO_PAUSED`
19. Focus `#video-container` → press `Space` to resume → `VIDEO_PLAY`

**Focus/blur on page 2:**
20. Dispatch `blur` → wait 200ms → `CLICK_OFF`
21. Dispatch `focus` → `CLICK_BACK`

**Advance:**
22. Wait for `#info-banner.warning` (10s watchTime + 10% videoProgress required)
23. Click `#next`

#### Step: page 3 — finish (modal + refresh + prev verification)

1. Wait for iframe H1 "Congrats!"

**Settings:**
2. Click `#settings-btn` → select "dark" in `#theme-select` → close via `#close-help`
3. Re-open settings → select "light" → close

**Help modal on page 3 + refresh:**
4. Open help → "Help with Current Page" → verify table shows all requirements met
5. "Back to Menu" → click "Refresh This Web Page"
6. Page reloads: `ui._onRefresh()` saves state then calls `window.location.reload()`
7. Wait for `state.initialized` again

**Verify state persisted:**
8. Click `#prev` → back on page 2
9. Verify quiz3/quiz4 still show submitted answers (check completed flag)
10. Click `#next` → back on page 3

**Advance:**
11. Wait for `#info-banner.warning` (watchTime ≥ 2s after returning)
12. Click `#next` → triggers end screen

#### Step: end screen (verify passed + journal + LMS)

1. Assert `#help-overlay` visible with `display: flex`
2. Assert "Course Completed" in `#help-content`
3. Assert score (71% or 71.4%) in `#help-content`
4. Assert "Print Certificate" button visible
5. Override `window.print = () => {}`
6. Click certificate button → assert `#certificate-print-area` contains score and student name

**Journal verification:**
7. Extract `journaler.report()` via `page.evaluate()` → returns 2D array `[[header], [row1], ...]`
8. Filter rows by event name (column index 2) and assert presence of:
   - `STARTED_NEW_COURSE`
   - `SCROLLED`
   - `VISIBILITY_HIDDEN`, `VISIBILITY_VISIBLE`
   - `CLICK_OFF`, `CLICK_BACK` (at least 2 of each)
   - `SUSPICIOUS_ACTION`
   - `VIDEO_PLAY`, `VIDEO_PAUSE`, `VIDEO_FORWARD`, `VIDEO_SPEED_CHANGE`
   - `VIDEO_MUTED`
   - `VIDEO_FULL_SCREEN`, `VIDEO_NORMAL_SCREEN` (conditional: if one present, check both)
   - `QUIZ_SUBMITTED`, `QUESTION_ANSWERED`
   - `PAGE_NEXT`, `PAGE_PREV` (conditional: see ticket #28 — state.js does not log these yet)
   - `PAGE_COMPLETE` (at least 3 — or 4 depending on refresh)
   - `COURSE_COMPLETE`

**LMS verification:**
9. Check `localStorage.getItem("course_data_status")` === `"passed"`

#### Step: reset via help modal

1. Click "Review Course Materials" → end screen dismissed → finish page shown
2. Register `page.on('dialog', dialog => dialog.accept())` for the confirm dialog
3. Click `#help-btn` → opens help
4. Click "Reset Course Progress" → confirm dialog accepted → page reloads
5. Wait for `state.initialized`
6. Verify fresh state: iframe H1 shows "Lesson Directions", score is 0

### Journal Event Checklist

Events that MUST appear in the log (at least once):

| Event | Source |
|-------|--------|
| STARTED_NEW_COURSE | Initial page load |
| SCROLLED | Page 0 scroll |
| VISIBILITY_HIDDEN | Page 0 visibility change |
| VISIBILITY_VISIBLE | Page 0 visibility change |
| CLICK_OFF | Page 1 and page 2 blur |
| CLICK_BACK | Page 1 and page 2 focus |
| PAGE_NEXT | Navigation forward (conditional: see ticket #28) |
| PAGE_PREV | Navigation backward (conditional: see ticket #28) |
| QUESTIONS_RENDERED | Quiz data received |
| QUESTION_ANSWERED | Quiz radio/text interactions |
| QUIZ_SUBMITTED | Quiz submit clicks |
| SUSPICIOUS_ACTION | Right-click and copy |
| VIDEO_PLAY | Video start/resume |
| VIDEO_PAUSE | Video pause |
| VIDEO_FORWARD | Video forward seek |
| VIDEO_SPEED_CHANGE | Speed selector change |
| VIDEO_MUTED | Mute button click |
| VIDEO_FULL_SCREEN | Fullscreen enter (optional) |
| VIDEO_NORMAL_SCREEN | Fullscreen exit (optional) |
| PAGE_COMPLETE | Page completion banner |
| COURSE_COMPLETE | Course end screen |

Events that SHOULD appear (verify counts ≥ expected):

| Event | Min Count |
|-------|-----------|
| CLICK_OFF | 2 |
| CLICK_BACK | 2 |
| PAGE_NEXT | 5+ (conditional: see ticket #28) |
| PAGE_PREV | 1 (conditional: see ticket #28) |
| QUIZ_SUBMITTED | 4 |
| QUESTION_ANSWERED | 8+ (one per question interaction) |
| VIDEO_FULL_SCREEN | 0 or 2 |
| VIDEO_NORMAL_SCREEN | 0 or 2 |

Note: PAGE_NEXT and PAGE_PREV are listed in the journalist encoding maps (codes '8' and '9') but no code in state.js currently calls `journaler.log('PAGE_NEXT', ...)` or `journaler.log('PAGE_PREV', ...)`. See ticket #28. The test asserts these conditionally — if they appear, they must have positive count; if they don't appear yet (due to the bug), the test doesn't fail.

### Key Technical Approaches

**Fullscreen:** Wrapped in try/catch. Headless Chromium may not support `requestFullscreen()`. If it fails, log a warning. Journal assertion conditionally checks: if `VIDEO_FULL_SCREEN` appears, `VIDEO_NORMAL_SCREEN` must also appear.

**Visibility change:**
```js
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', {
    configurable: true, get: () => true
  });
  document.dispatchEvent(new Event('visibilitychange'));
});
```

**Focus/blur:**
```js
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await page.waitForTimeout(200);
await page.evaluate(() => window.dispatchEvent(new Event('focus')));
```

**Anti-cheat events:**
```js
await page.evaluate(() => {
  document.querySelector('course-quiz .quiz-container')
    .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
});
```
Note: Only effective on quizzes without `disable-anticheat`. In the barely-pass test, this is only fired on quiz3 (page 2).

**TTS:** Click the `.tts-btn` inside a quiz question. Speech synthesis fires but no audio assertion in headless. Tests the code path and prevents regression.

**Refresh handling:**
- After clicking "Refresh This Web Page", the page reloads
- Re-wait for `state.initialized`
- Then navigate `#prev` to verify state

**Reset handling:**
- Register `page.on('dialog', dialog => dialog.accept())` before clicking reset
- After reload, verify fresh state (page 0, no progress)

## Test Timeouts

| Test | Timeout |
|------|---------|
| pass.test.js | 90000ms |
| fail.test.js | 90000ms |
| barely-pass.test.js | 120000ms |
