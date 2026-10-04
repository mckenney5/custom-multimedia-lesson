const { test, expect } = require("@playwright/test");
const { setupE2EPage } = require("../../helpers/e2e-setup.js");
const { setupPage } = require("../../helpers/page-setup.js");
const {
	setProgrammingCode,
	runProgrammingCode,
	assertProgrammingResult,
} = require("../../helpers/navigation.js");

test.describe("E2E Programming Component Integration in Lesson Flow", () => {
	test.setTimeout(120000);

	async function completePages02(page, iframe) {
		// PAGE 0: directions
		await expect(iframe.locator("h1")).toHaveText("Lesson Directions");
		await page.evaluate(() => {
			const f = document.getElementById("lesson-frame");
			f.contentWindow.scrollTo({
				top: f.contentDocument.body.scrollHeight,
				behavior: "smooth",
			});
		});
		await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
		await page.locator("#next").click();

		// PAGE 1: multi_example
		await expect(iframe.locator("h1")).toHaveText("Page 1");
		const quiz1 = iframe.locator("course-quiz#quiz1");
		const quiz2 = iframe.locator("course-quiz#quiz2");

		await quiz1.locator("label").filter({ hasText: "True" }).click();
		await quiz1.locator("#Q2_text").fill("4");
		await quiz1.locator(".btn-submit").click();

		await quiz2.locator("label").filter({ hasText: "red" }).click();
		await quiz2.locator("label").filter({ hasText: "orange" }).click();
		await quiz2.locator("label").filter({ hasText: "yellow" }).click();
		await quiz2.locator("label").filter({ hasText: "0.3mg" }).click();
		await quiz2.locator(".btn-submit").click();

		await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
		await page.locator("#next").click();

		// PAGE 2: multi_example2
		await expect(iframe.locator("h1")).toHaveText("Page 4");
		await iframe.locator("#play-pause").click();

		const quiz3 = iframe.locator("course-quiz#quiz3");
		const quiz4 = iframe.locator("course-quiz#quiz4");

		await quiz3.locator("label").filter({ hasText: "False" }).click();
		await quiz3.locator("label").filter({ hasText: "2" }).click();
		await quiz3.locator(".btn-submit").click();

		await quiz4.locator("label").filter({ hasText: "red" }).click();
		await quiz4.locator("label").filter({ hasText: "orange" }).click();
		await quiz4.locator("label").filter({ hasText: "yellow" }).click();
		await quiz4.locator("label").filter({ hasText: "0.3mg" }).click();
		await quiz4.locator("label").filter({ hasText: "0.15mg" }).click();
		await quiz4.locator(".btn-submit").click();

		await page.locator("#info-banner.warning").waitFor({ timeout: 45000 });
		await page.waitForTimeout(10000);
		await page.locator("#next").click();
	}

	// The attempt limit lives in the lesson data; rewrite it at the network
	// boundary so the shipped course_data.json stays untouched.
	async function withProgrammingAttemptLimit(page, attempts) {
		await page.route("**/lessons/course_data.json", async (route) => {
			const data = await (await route.fetch()).json();
			const programmingPage = data.pages.find((p) => p.name === "programming_example.html");
			if (!programmingPage) {
				console.error("withProgrammingAttemptLimit: no page named programming_example.html");
				await route.continue();
				return;
			}
			programmingPage.completionRules = { ...(programmingPage.completionRules || {}), attempts };
			await route.fulfill({ json: data });
		});
	}

	// Withhold the parent's PROGRAMMING_DATA reply so the component genuinely sits
	// in its config-not-loaded state.
	//
	// The mechanism is indirect: state.js replies with
	// lessonFrame.contentWindow.postMessage(...), which resolves `postMessage` on
	// THIS frame's global — so overriding it here intercepts traffic flowing
	// parent -> child. It does NOT intercept what this frame sends: children.send()
	// uses window.parent.postMessage(...), which resolves on the parent's global
	// and must keep flowing (the CODE_EXECUTION assertion below reads it).
	// Re-wiring the PARENT side (state.js) to a captured Window.prototype.postMessage
	// bypasses this override and breaks the test loudly: the config loads, the run
	// executes, and the payload assertions fail. The child side is not part of the
	// contract — children.send() is not intercepted in the first place.
	async function withholdProgrammingConfig(page) {
		await page.addInitScript(() => {
			if (window === window.top) return;
			const nativePostMessage = window.postMessage.bind(window);
			window.postMessage = (data, ...rest) => {
				if (data && data.type === "PROGRAMMING_DATA") return;
				return nativePostMessage(data, ...rest);
			};
		});
	}

	test("wrong programming answer blocks page advancement until corrected", async ({ page }) => {
		await setupE2EPage(page);
		const iframe = page.frameLocator("#lesson-frame");

		await test.step("navigate to programming page via pages 0-2", async () => {
			await completePages02(page, iframe);
		});

		await test.step("wrong answer blocks completion, then correction unblocks", async () => {
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics");

			await setProgrammingCode(iframe, "prog_hello", 'function greet() { return "Goodbye!"; }\n\nconsole.log(greet());');
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "failed");

			// toolbar readouts are shown after a run
			const progHello = iframe.locator("course-programming#prog_hello");
			await expect(progHello.locator(".prog-score")).toHaveText("Best score: 0%");
			await expect(progHello.locator(".prog-attempts")).toHaveText("Attempts left: Unlimited");

			await expect(page.locator("#info-banner.warning")).not.toBeVisible({ timeout: 5000 });

			await setProgrammingCode(iframe, "prog_hello", 'function greet() { return "Hello, World!"; }\n\nconsole.log(greet());');
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "passed");

			// ...and both readouts track the next run
			await expect(progHello.locator(".prog-score")).toHaveText("Best score: 100%");
			await expect(progHello.locator(".prog-attempts")).toHaveText("Attempts left: Unlimited");

			// a later worse run keeps the latched best score in the toolbar while the
			// results panel underneath shows the latest run's failure
			await setProgrammingCode(iframe, "prog_hello", 'function greet() { return "Goodbye!"; }\n\nconsole.log(greet());');
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "failed");
			await expect(progHello.locator(".prog-score")).toHaveText("Best score: 100%");

			// put the passing answer back so the rest of the flow still completes
			await setProgrammingCode(iframe, "prog_hello", 'function greet() { return "Hello, World!"; }\n\nconsole.log(greet());');
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "passed");
			await expect(progHello.locator(".prog-score")).toHaveText("Best score: 100%");

			await setProgrammingCode(iframe, "prog_double", "function double_value(n) { return n * n; }\n\nconsole.log(double_value(4));");
			await runProgrammingCode(iframe, "prog_double");
			await assertProgrammingResult(iframe, "prog_double", "passed");

			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
			await page.locator("#next").click();
		});

		await test.step("finish page and end screen", async () => {
			await expect(iframe.locator("h1")).toHaveText("Congrats!");
			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
			await page.waitForTimeout(10000);
			await page.locator("#next").click();

			const helpOverlay = page.locator("#help-overlay");
			await expect(helpOverlay).toBeVisible({ timeout: 15000 });
			await expect(helpOverlay).toHaveCSS("display", "flex");
			await expect(helpOverlay.locator("#help-content")).toContainText("Course Completed");
			await expect(helpOverlay.locator("#help-content")).toContainText("100%");

			const certBtn = helpOverlay.locator("button", { hasText: "Print Certificate" });
			await expect(certBtn).toBeVisible();
			await page.evaluate(() => window.print = () => {});
			await certBtn.click();
			const certArea = page.locator("#certificate-print-area");
			await expect(certArea).toContainText("100%");
			await expect(certArea).toContainText("Student");
		});
	});

	test("partial credit on programming page does not allow advancement", async ({ page }) => {
		await setupE2EPage(page);
		const iframe = page.frameLocator("#lesson-frame");

		await test.step("navigate to programming page via pages 0-2", async () => {
			await completePages02(page, iframe);
		});

		await test.step("one correct, one wrong — page stays incomplete", async () => {
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics");

			await setProgrammingCode(iframe, "prog_hello", 'function greet() { return "Hello, World!"; }\n\nconsole.log(greet());');
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "passed");

			await setProgrammingCode(iframe, "prog_double", "function double_value(n) { return n; }\n\nconsole.log(double_value(4));");
			await runProgrammingCode(iframe, "prog_double");
			await assertProgrammingResult(iframe, "prog_double", "failed");

			await expect(page.locator("#info-banner.warning")).not.toBeVisible({ timeout: 5000 });
		});

		await test.step("fix the wrong one — page becomes complete", async () => {
			await setProgrammingCode(iframe, "prog_double", "function double_value(n) { return n * n; }\n\nconsole.log(double_value(4));");
			await runProgrammingCode(iframe, "prog_double");
			await assertProgrammingResult(iframe, "prog_double", "passed");

			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
			await page.locator("#next").click();
		});

		await test.step("finish page and end screen", async () => {
			await expect(iframe.locator("h1")).toHaveText("Congrats!");
			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
			await page.waitForTimeout(10000);
			await page.locator("#next").click();

			const helpOverlay = page.locator("#help-overlay");
			await expect(helpOverlay).toBeVisible({ timeout: 15000 });
			await expect(helpOverlay).toHaveCSS("display", "flex");
			await expect(helpOverlay.locator("#help-content")).toContainText("Course Completed");
			await expect(helpOverlay.locator("#help-content")).toContainText("100%");
		});
	});

	test("next stays blocked after a failing run until every assignment passes", async ({ page }) => {
		await setupE2EPage(page);
		const iframe = page.frameLocator("#lesson-frame");

		await test.step("navigate to programming page via pages 0-2", async () => {
			await completePages02(page, iframe);
		});

		await test.step("a failing run keeps the next button blocked", async () => {
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics");

			await setProgrammingCode(iframe, "prog_hello", 'function greet() { return "Goodbye!"; }\n\nconsole.log(greet());');
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "failed");

			// The denial branch and advancePage() are mutually exclusive, so the
			// error banner already says the page did not move; the index check is
			// what proves it stays put after the click, rather than asserting the
			// h1 that would pass against whatever text is on screen right now.
			const indexBefore = await page.evaluate(() => state.data.delta.currentPageIndex);
			await page.locator("#next").click();
			await expect(page.locator("#info-banner.error")).toContainText(
				"You must complete the current page to continue",
			);
			expect(await page.evaluate(() => state.data.delta.currentPageIndex)).toBe(indexBefore);
		});

		await test.step("passing both assignments unblocks the next button", async () => {
			await setProgrammingCode(iframe, "prog_hello", 'function greet() { return "Hello, World!"; }\n\nconsole.log(greet());');
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "passed");

			await setProgrammingCode(iframe, "prog_double", "function double_value(n) { return n * n; }\n\nconsole.log(double_value(4));");
			await runProgrammingCode(iframe, "prog_double");
			await assertProgrammingResult(iframe, "prog_double", "passed");

			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
			await page.locator("#next").click();
			await expect(iframe.locator("h1")).toHaveText("Congrats!", { timeout: 10000 });
		});
	});

	test("reload mid-assignment restores the editor draft from the saved component state", async ({ page }) => {
		// setupE2EPage clears localStorage from an init script, and init scripts run
		// again on the reload — that would wipe the very save this journey restores,
		// so go through setupPage (the context starts empty anyway).
		await setupPage(page);
		// onbeforeunload advertises "progress may be lost" for an incomplete page;
		// accept it or the reload is cancelled.
		page.on("dialog", (dialog) => dialog.accept());
		const iframe = page.frameLocator("#lesson-frame");
		const draft = 'function greet() { return "Howdy!"; }\n\nconsole.log(greet());';

		await test.step("navigate to programming page via pages 0-2", async () => {
			await completePages02(page, iframe);
		});

		await test.step("run a draft, then reload the page", async () => {
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics");

			await setProgrammingCode(iframe, "prog_hello", draft);
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "failed");

			await page.reload();
			await page.waitForFunction(() => typeof state !== "undefined" && state.initialized);
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics", { timeout: 10000 });
		});

		await test.step("editor shows the draft that was saved before the reload", async () => {
			await expect.poll(
				() => iframe
					.locator("course-programming#prog_hello")
					.evaluate((el) => (el.editor ? el.editor.getValue() : "")),
				{ timeout: 10000 },
			).toBe(draft);
		});
	});

	test("exhausting the attempt limit disables run and leaves the final score visible", async ({ page }) => {
		await withProgrammingAttemptLimit(page, 2);
		await setupE2EPage(page);
		const iframe = page.frameLocator("#lesson-frame");
		const progHello = iframe.locator("course-programming#prog_hello");

		await test.step("navigate to programming page via pages 0-2", async () => {
			await completePages02(page, iframe);
		});

		await test.step("first attempt is spent and one is left", async () => {
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics");

			await setProgrammingCode(iframe, "prog_hello", 'function greet() { return "Goodbye!"; }\n\nconsole.log(greet());');
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "failed");

			await expect(progHello.locator(".prog-score")).toHaveText("Best score: 0%");
			await expect(progHello.locator(".prog-attempts")).toHaveText("Attempts left: 1");
			await expect(progHello.locator(".prog-btn-run")).toBeEnabled();
		});

		await test.step("last attempt exhausts the run button but the score stays on screen", async () => {
			await setProgrammingCode(iframe, "prog_hello", 'function greet() { return "Hello, World!"; }\n\nconsole.log(greet());');
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "passed");

			await expect(progHello.locator(".prog-score")).toHaveText("Best score: 100%");
			await expect(progHello.locator(".prog-attempts")).toHaveText("Attempts left: 0");
			await expect(progHello.locator(".prog-btn-run")).toBeDisabled();
			await expect(progHello.locator(".prog-btn-run")).toHaveText("No Attempts Left");
		});
	});

	test("running before the config reply leaves the saved draft untouched", async ({ page }) => {
		await withholdProgrammingConfig(page);
		await setupE2EPage(page);
		const iframe = page.frameLocator("#lesson-frame");
		const progHello = iframe.locator("course-programming#prog_hello");

		// Observe CODE_EXECUTION where the parent receives it, i.e. after
		// children.send() -> postMessage -> structured clone, not inside send().
		await page.evaluate(() => {
			window.__codeExecPayloads = [];
			window.addEventListener("message", (event) => {
				if (!event.data || event.data.type !== "CODE_EXECUTION") return;
				const wrapped = event.data.message || {};
				const payload = typeof wrapped.value === "object" && wrapped.value !== null
					? wrapped.value
					: wrapped;
				window.__codeExecPayloads.push({
					componentId: wrapped.id || null,
					hasCodeKey: Object.prototype.hasOwnProperty.call(payload, "code"),
					codeType: typeof payload.code,
				});
			});
		});

		await test.step("navigate to programming page via pages 0-2", async () => {
			await completePages02(page, iframe);
		});

		await test.step("run a component that never received its config", async () => {
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics");

			await runProgrammingCode(iframe, "prog_hello");
			await expect(progHello.locator(".prog-output-text")).toContainText(
				"Component configuration not loaded yet",
			);
			await expect(progHello.locator(".prog-btn-run")).toBeEnabled();
		});

		await test.step("parent journals the run, stores no draft and spends no attempt", async () => {
			// The payload is delivered as a posted-message task while page.evaluate
			// is served from another task source, so poll instead of reading once.
			await expect
				.poll(async () => (await page.evaluate(() => window.__codeExecPayloads)).length, {
					timeout: 10000,
				})
				.toBeGreaterThanOrEqual(1);
			const observed = await page.evaluate(() => window.__codeExecPayloads);
			expect(observed[observed.length - 1]).toEqual({
				componentId: "prog_hello",
				hasCodeKey: true,
				codeType: "undefined",
			});

			// Positive control: only state.handleMessage writes this row, so the two
			// absence claims below cannot be satisfied by the parent never handling
			// the message.
			const report = await page.evaluate(() => journaler.report());
			const handled = report.slice(1).filter(
				(r) => r[2] === "CODE_EXEC" && r[4] && r[4].includes("prog_hello"),
			);
			expect(handled.length).toBeGreaterThanOrEqual(1);

			const componentState = await page.evaluate(() => {
				const page = state.data.pages[state.data.delta.currentPageIndex];
				const pageDelta = state.data.delta.pagesState[state.data.delta.currentPageIndex];
				const config = page.components.find((c) => c.id === "prog_hello");
				return {
					codeContent: pageDelta.components.prog_hello.codeContent,
					starterCode: config.starterCode,
					attempts: pageDelta.components.prog_hello.attempts,
				};
			});
			expect(componentState.codeContent).toBe(componentState.starterCode);
			expect(componentState.attempts).toBe(0);
		});
	});

	test("programming state preserved across prev/next navigation", async ({ page }) => {
		await setupE2EPage(page);
		const iframe = page.frameLocator("#lesson-frame");

		await test.step("navigate to programming page via pages 0-2", async () => {
			await completePages02(page, iframe);
		});

		await test.step("complete both programming exercises and advance to finish", async () => {
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics");

			await setProgrammingCode(iframe, "prog_hello", 'function greet() { return "Hello, World!"; }\n\nconsole.log(greet());');
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "passed");

			await setProgrammingCode(iframe, "prog_double", "function double_value(n) { return n * n; }\n\nconsole.log(double_value(4));");
			await runProgrammingCode(iframe, "prog_double");
			await assertProgrammingResult(iframe, "prog_double", "passed");

			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
			await page.locator("#next").click();
			await expect(iframe.locator("h1")).toHaveText("Congrats!");
		});

		await test.step("go back to programming page — state restored", async () => {
			await page.locator("#prev").click();
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics", { timeout: 10000 });

			// Wait for component to receive saved state from parent
			await page.waitForTimeout(1000);

			// Verify code is restored in the editor
			const helloCode = await iframe.locator("course-programming#prog_hello").evaluate(el => {
				return el.editor ? el.editor.getValue() : null;
			});
			expect(helloCode).toContain('return "Hello, World!"');

			const doubleCode = await iframe.locator("course-programming#prog_double").evaluate(el => {
				return el.editor ? el.editor.getValue() : null;
			});
			expect(doubleCode).toContain("return n * n");

			// Verify test results rendered
			await expect(
				iframe.locator("course-programming#prog_hello .prog-test-result.passed").first(),
			).toBeVisible({ timeout: 10000 });
			await expect(
				iframe.locator("course-programming#prog_double .prog-test-result.passed").first(),
			).toBeVisible({ timeout: 10000 });
		});

		await test.step("go forward again to finish page", async () => {
			await page.locator("#next").click();
			await expect(iframe.locator("h1")).toHaveText("Congrats!", { timeout: 10000 });
		});
	});

	test("programming execution events appear in journal", async ({ page }) => {
		await setupE2EPage(page);
		const iframe = page.frameLocator("#lesson-frame");

		await test.step("navigate to programming page via pages 0-2", async () => {
			await completePages02(page, iframe);
		});

		await test.step("execute programming exercises", async () => {
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics");

			await setProgrammingCode(iframe, "prog_hello", 'function greet() { return "Hello, World!"; }\n\nconsole.log(greet());');
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "passed");

			await setProgrammingCode(iframe, "prog_double", "function double_value(n) { return n * n; }\n\nconsole.log(double_value(4));");
			await runProgrammingCode(iframe, "prog_double");
			await assertProgrammingResult(iframe, "prog_double", "passed");
		});

		await test.step("journal contains CODE_EXEC events with correct scores", async () => {
			const report = await page.evaluate(() => journaler.report());
			const codeExecEvents = report.slice(1).filter(r => r[2] === "CODE_EXEC");

			expect(codeExecEvents.length).toBeGreaterThanOrEqual(2);

			const details = codeExecEvents.map(r => r[4]);
			const allHaveScore = details.every(d => d.includes("score:"));
			expect(allHaveScore).toBe(true);

			const hasHello = details.some(d => d.includes("prog_hello"));
			const hasDouble = details.some(d => d.includes("prog_double"));
			expect(hasHello).toBe(true);
			expect(hasDouble).toBe(true);
		});
	});
});
