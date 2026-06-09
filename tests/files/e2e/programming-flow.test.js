const { test, expect } = require("@playwright/test");
const { setupE2EPage } = require("../../helpers/e2e-setup.js");
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

			await expect(page.locator("#info-banner.warning")).not.toBeVisible({ timeout: 5000 });

			await setProgrammingCode(iframe, "prog_hello", 'function greet() { return "Hello, World!"; }\n\nconsole.log(greet());');
			await runProgrammingCode(iframe, "prog_hello");
			await assertProgrammingResult(iframe, "prog_hello", "passed");

			await setProgrammingCode(iframe, "prog_double", 'function double_value(n) { return n * n; }\n\nconsole.log(double_value(4));');
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

			await setProgrammingCode(iframe, "prog_double", 'function double_value(n) { return n; }\n\nconsole.log(double_value(4));');
			await runProgrammingCode(iframe, "prog_double");
			await assertProgrammingResult(iframe, "prog_double", "failed");

			await expect(page.locator("#info-banner.warning")).not.toBeVisible({ timeout: 5000 });
		});

		await test.step("fix the wrong one — page becomes complete", async () => {
			await setProgrammingCode(iframe, "prog_double", 'function double_value(n) { return n * n; }\n\nconsole.log(double_value(4));');
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

			await setProgrammingCode(iframe, "prog_double", 'function double_value(n) { return n * n; }\n\nconsole.log(double_value(4));');
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

			await setProgrammingCode(iframe, "prog_double", 'function double_value(n) { return n * n; }\n\nconsole.log(double_value(4));');
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
