const { test, expect } = require("@playwright/test");
const { completeProgrammingExercises } = require("../../helpers/navigation.js");

test.describe("Complete course with barely-passing grade", () => {
	test.setTimeout(120000);

	test("should complete all pages with comprehensive interactions and show barely-pass end screen", async ({ page }) => {
		// Clear localStorage only on first load (not on refresh), using sessionStorage as a persistent flag
		await page.addInitScript(() => {
			if (!sessionStorage.getItem("_cleared")) {
				localStorage.clear();
				sessionStorage.setItem("_cleared", "true");
			}
		});
		await page.goto("http://localhost:8080/");
		await page.waitForFunction(() =>
			typeof state !== "undefined" && state.initialized,
		);
		const iframe = page.frameLocator("#lesson-frame");

		// === PAGE 0: directions.html ===
		await test.step("directions page: scroll, visibility toggles, advance", async () => {
			await expect(iframe.locator("h1")).toHaveText("Lesson Directions");
			await page.evaluate(() => {
				const f = document.getElementById("lesson-frame");
				f.contentWindow.scrollTo({
					top: f.contentDocument.body.scrollHeight,
					behavior: "smooth",
				});
			});

			await page.evaluate(() => {
				Object.defineProperty(document, "hidden", {
					configurable: true, get: () => true,
				});
				document.dispatchEvent(new Event("visibilitychange"));
			});

			await page.evaluate(() => {
				Object.defineProperty(document, "hidden", {
					configurable: true, get: () => false,
				});
				document.dispatchEvent(new Event("visibilitychange"));
			});

			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
			await page.locator("#next").click();
		});

		// === PAGE 1: multi_example.html ===
		await test.step("multi_example page: quizzes, focus/blur, advance", async () => {
			await expect(iframe.locator("h1")).toHaveText("Page 1");
			const quiz1 = iframe.locator("course-quiz#quiz1");
			const quiz2 = iframe.locator("course-quiz#quiz2");

			await quiz1.locator("label").filter({ hasText: "False" }).click();
			await quiz1.locator("#Q2_text").click();
			await quiz1.locator("#Q2_text").fill("4");
			await quiz1.locator(".btn-submit").click();

			await page.evaluate(() => window.dispatchEvent(new Event("blur")));
			await page.waitForTimeout(200);
			await page.evaluate(() => window.dispatchEvent(new Event("focus")));

			await quiz2.locator("label").filter({ hasText: "blue" }).click();
			await quiz2.locator("label").filter({ hasText: "0.3mg" }).click();

			await quiz2.locator(".btn-submit").click();

			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
			await page.locator("#next").click();
		});

		// === PAGE 2: multi_example2.html ===
		await test.step("multi_example2 page: video, quiz3, help modal, quiz4, video controls, resume via keyboard, focus/blur, advance", async () => {
			await expect(iframe.locator("h1")).toHaveText("Page 4");

			await iframe.locator("#play-pause").click();

			const quiz3 = iframe.locator("course-quiz#quiz3");
			await quiz3.locator("label").filter({ hasText: "False" }).click();
			await quiz3.locator("label").filter({ hasText: "2" }).click();
			await quiz3.locator(".tts-btn").first().click();
			await iframe.locator("course-quiz#quiz3 .quiz-container").evaluate(el => {
				el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
			});
			await quiz3.locator(".btn-submit").click();

			await page.locator("#help-btn").click();
			await page.locator("button.help-action-btn", { hasText: "Help with Current Page" }).click();
			await expect(page.locator("#help-content")).toContainText("Minimum Score");
			await page.locator("button.help-action-btn", { hasText: "Back to Menu" }).click();
			await page.locator("button.help-action-btn", { hasText: "General Course Help" }).click();
			await expect(page.locator("#help-content iframe.help-iframe")).toBeVisible();
			await page.locator("button.help-action-btn", { hasText: "Back to Menu" }).click();
			await page.locator("#close-help").click();
			await expect(page.locator("#help-overlay")).not.toBeVisible({ timeout: 5000 });

			const quiz4 = iframe.locator("course-quiz#quiz4");
			await quiz4.locator("label").filter({ hasText: "red" }).click();
			await quiz4.locator("label").filter({ hasText: "orange" }).click();
			await quiz4.locator("label").filter({ hasText: "yellow" }).click();
			await quiz4.locator("label").filter({ hasText: "0.3mg" }).click();
			await quiz4.locator("label").filter({ hasText: "0.15mg" }).click();
			await quiz4.locator(".btn-submit").click();

			await iframe.locator("#forward").click();
			await iframe.locator("#speed-select").selectOption("2");
			await iframe.locator("#mute-btn").click();

			try {
				await iframe.locator("#full-screen").click();
				await page.waitForTimeout(300);
				await iframe.locator("#full-screen").click();
				await page.waitForTimeout(300);
				await iframe.locator("#full-screen").click();
				await page.waitForTimeout(300);
				await iframe.locator("#full-screen").click();
			} catch {
				console.warn("Fullscreen not supported in headless mode");
			}

			await iframe.locator("#play-pause").click();
			await iframe.locator("#video-container").press("Space");

			await page.evaluate(() => window.dispatchEvent(new Event("blur")));
			await page.waitForTimeout(200);
			await page.evaluate(() => window.dispatchEvent(new Event("focus")));

			await page.locator("#info-banner.warning").waitFor({ timeout: 60000 });
			await page.locator("#next").click();
		});

		// === PAGE 3: programming_example.html ===
		await test.step("programming page: complete both exercises correctly and advance", async () => {
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics");
			await completeProgrammingExercises(iframe);
			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
			await page.locator("#next").click();
		});

		// === PAGE 4: finish.html ===
		await test.step("finish page: settings, help, refresh, prev verification, advance", async () => {
			await expect(iframe.locator("h1")).toHaveText("Congrats!", { timeout: 15000 });

			await page.locator("#settings-btn").click();
			await page.locator("#theme-select").selectOption("dark");
			await page.locator("#close-help").click();
			await expect(page.locator("#help-overlay")).not.toBeVisible({ timeout: 5000 });

			await page.locator("#settings-btn").click();
			await page.locator("#theme-select").selectOption("light");
			await page.locator("#close-help").click();
			await expect(page.locator("#help-overlay")).not.toBeVisible({ timeout: 5000 });

			await page.locator("#help-btn").click();
			await page.locator("button.help-action-btn", { hasText: "Help with Current Page" }).click();
			await expect(page.locator("#help-content")).toContainText("Requirement");
			await page.locator("button.help-action-btn", { hasText: "Back to Menu" }).click();
			await page.locator("button.help-action-btn", { hasText: "Refresh This Web Page" }).click();

			await page.waitForFunction(() =>
				typeof state !== "undefined" && state.initialized,
			);

			const pageIdx = await page.evaluate(() => state.data.delta.currentPageIndex);
			expect(pageIdx).toBe(4);

			await page.locator("#prev").click();
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics", { timeout: 10000 });

			await page.locator("#prev").click();
			await expect(iframe.locator("h1")).toHaveText("Page 4", { timeout: 10000 });

			const quiz3Completed = await page.evaluate(() =>
				state.data.delta.pagesState[2].components["quiz3"]?.completed,
			);
			expect(quiz3Completed).toBe(true);
			const quiz4Completed = await page.evaluate(() =>
				state.data.delta.pagesState[2].components["quiz4"]?.completed,
			);
			expect(quiz4Completed).toBe(true);

			await page.locator("#next").click();
			await expect(iframe.locator("h1")).toHaveText("JavaScript Basics", { timeout: 10000 });

			await page.locator("#next").click();
			await expect(iframe.locator("h1")).toHaveText("Congrats!", { timeout: 10000 });

			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });

			await page.evaluate(() => {
				const min = (state.data.courseRules.minimumMinutes || 0) * 60;
				const needed = Math.max(0, min - state.data.delta.totalCourseSeconds + 3);
				if (needed > 0) {
					return new Promise(resolve => setTimeout(resolve, needed * 1000));
				}
			});

			await page.locator("#next").click();
		});

		// === END SCREEN ===
		await test.step("end screen: verify passed state, journal events, and LMS status", async () => {
			const helpOverlay = page.locator("#help-overlay");
			await expect(helpOverlay).toBeVisible({ timeout: 15000 });
			await expect(helpOverlay).toHaveCSS("display", "flex");
			await expect(helpOverlay.locator("#help-content")).toContainText("Course Completed");
			await expect(helpOverlay.locator("#help-content")).toContainText("83%");

			const certBtn = helpOverlay.locator("button", { hasText: "Print Certificate" });
			await expect(certBtn).toBeVisible();

			await page.evaluate(() => window.print = () => {});
			await certBtn.click();
			const certArea = page.locator("#certificate-print-area");
			await expect(certArea).toContainText("83%");
			await expect(certArea).toContainText("Student");

			const report = await page.evaluate(() => {
				return journaler.report();
			});
			const rowEvents = report.slice(1).map(r => r[2]);
			const events = rowEvents;

			const eventCounts = {};
			for (const e of events) {
				eventCounts[e] = (eventCounts[e] || 0) + 1;
			}

			const requiredEvents = [
				"STARTED_NEW_COURSE",
				"SCROLLED",
				"VISIBILITY_HIDDEN",
				"VISIBILITY_VISIBLE",
				"CLICK_OFF",
				"CLICK_BACK",
				"QUESTIONS_RENDERED",
				"QUESTION_ANSWERED",
				"QUIZ_SUBMITTED",
				"SUSPICIOUS_ACTION",
				"VIDEO_PLAY",
				"VIDEO_PAUSE",
				"VIDEO_FORWARD",
				"VIDEO_SPEED_CHANGE",
				"VIDEO_MUTED",
				"PAGE_COMPLETE",
				"PAGE_NEXT",
				"PAGE_PREV",
				"CODE_EXEC",
				"COURSE_COMPLETE",
			];

			for (const evt of requiredEvents) {
				expect(eventCounts[evt] || 0).toBeGreaterThanOrEqual(1);
			}

			const clickOffCount = events.filter(e => e === "CLICK_OFF").length;
			const clickBackCount = events.filter(e => e === "CLICK_BACK").length;
			expect(clickOffCount).toBeGreaterThanOrEqual(2);
			expect(clickBackCount).toBeGreaterThanOrEqual(2);

			const quizSubmittedCount = events.filter(e => e === "QUIZ_SUBMITTED").length;
			expect(quizSubmittedCount).toBeGreaterThanOrEqual(4);

			const videoFsCount = events.filter(e => e === "VIDEO_FULL_SCREEN").length;
			const videoNsCount = events.filter(e => e === "VIDEO_NORMAL_SCREEN").length;
			if (videoFsCount > 0) {
				expect(videoNsCount).toBeGreaterThanOrEqual(2);
			}

			const status = await page.evaluate(() => localStorage.getItem("course_data_status"));
			expect(status).toBe("passed");
		});

		// === RESET ===
		await test.step("reset via help modal: dismiss end screen, reset, verify fresh state", async () => {
			await page.locator("button.help-action-btn", { hasText: "Review Course Materials" }).click();
			await page.waitForFunction(() =>
				typeof state !== "undefined" && state.initialized,
			);

			page.on("dialog", dialog => dialog.accept());

			await page.locator("#help-btn").click();
			await page.locator("button.help-action-btn", { hasText: "Reset Course Progress" }).click();
			await page.waitForFunction(() =>
				typeof state !== "undefined" && state.initialized,
			);

			await expect(iframe.locator("h1")).toHaveText("Lesson Directions", { timeout: 10000 });

			const totalScore = await page.evaluate(() => {
				const grade = completion.calculateOverallGrade(
					state.data.pages,
					state.data.delta.pagesState,
				);
				return grade.earnedScore;
			});
			expect(totalScore).toBe(0);
		});
	});
});
