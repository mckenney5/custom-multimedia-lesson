# Fail Closed `requireSubmission` When a Page Declares Zero Submission Components

`completion.js:7-14` and `ui.js:121-135` both gate page advancement and the help modal on `requireSubmission` by filtering the page's components to `quiz`/`programming` entries and calling `every()` on the result. `[].every(...)` is `true`, so a page whose author explicitly wrote `"requireSubmission": true` but which declares no submission components (only `article`/`video`, or no `components` key at all) passed the rule vacuously — the instruction silently did nothing, and the help modal showed a green "Submitted" row for a page where nothing was ever submitted.

Two tests in `tests/files/completion/checkIfComplete.test.js` pinned this behavior as an open decision (ticket #62); this ADR is that decision.

**Decision**: Fail closed. When `completionRules.requireSubmission` is true and the page yields zero submission components, `checkIfComplete` returns `false` — for both inputs (missing `components` key, and `components` containing no quiz/programming entry). The help modal renders the same verdict.

**Consequences**:
- Matches author intent: `requireSubmission: true` is an explicit "learners must submit something", so a page that cannot accept a submission is a configuration error, not a page that should advance.
- Protects the research data, which is this repo's product: fail-open silently corrupted completion records with no signal to researcher or learner; fail-closed refuses to record a pass that never happened.
- A misconfigured page becomes permanently unpassable. This is caught at authoring/preview time rather than after data collection — the failure moves to where it is cheapest.
- The shipped corpus was re-verified: only `multi_example.html` (2 quizzes) and `programming_example.html` (2 programming components) set `requireSubmission: true`, and both declare submission components, so no existing lesson changes behavior.
- Note the interaction with the independent score rule: a page with no quiz/programming components has `maxScore === 0`, so `checkIfComplete`'s score term already evaluates `0 >= completionRules.score`. The rules only diverge when `score: 0` *and* zero submission components — which is exactly the shape this decision closes.

**Companion behaviors decided with it** (specified in ticket #62, landing pre-merge):
- **Load-time diagnostic**: `loadCourseData` `console.error`s when a page sets `requireSubmission: true` with zero submission components, naming the page. The permanently-unpassable failure mode is therefore loud at load time for the author and never shown to the learner. Sits beside the existing per-component `console.error` warnings.
- **Help modal row**: when `requireSubmission` is true and there are zero submission components, the modal does not render the default "Submit Quizzes" label (misleading — there are no quizzes). It renders a distinct "Submission Required" row with a Pending/fail status: honest to the learner, and the load-time error tells the author how to fix it.

**Alternatives considered**:
- *Fail open* (status quo before this ADR): never bricks a lesson, but the rule silently does nothing, which for completion data collected in an ed-psych study is worse than a loud, early, fixable failure.
- *Fail open with a warning*: keeps the silent pass in the data while adding a console line nobody reads during a study; rejected for the same data-integrity reason.

**Follow-ups**: ticket #63 extracts the shared `requireSubmission` helper so `completion.js` and `ui.js` cannot drift apart again. Ticket #65 (post-merge) generalizes this class of config error into an authoring-time lesson verifier.
