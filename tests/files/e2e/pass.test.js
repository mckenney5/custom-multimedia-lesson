const { test, expect } = require("@playwright/test");
const { setupE2EPage } = require("../../helpers/e2e-setup.js");

test.describe("Complete course with passing grade", () => {
	test.setTimeout(90000);

	test("should complete all pages and show passed end screen", async ({ page }) => {
		await setupE2EPage(page);
		const iframe = page.frameLocator("#lesson-frame");

		// === PAGE 0: directions.html ===
		await test.step("directions page: scroll and advance", async () => {
			await expect(iframe.locator("h1")).toHaveText("Lesson Directions");
			await page.waitForTimeout(500);
			await page.evaluate(() => {
				const f = document.getElementById("lesson-frame");
				f.contentWindow.scrollTo({
					top: f.contentDocument.body.scrollHeight,
					behavior: "smooth",
				});
			});
			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
			await page.locator("#next").click();
		});

		// === PAGE 1: multi_example.html ===
		await test.step("multi_example page: answer quizzes and advance", async () => {
			await expect(iframe.locator("h1")).toHaveText("Page 1");
			await page.waitForTimeout(500);
			const quiz1 = iframe.locator("course-quiz#quiz1");
			const quiz2 = iframe.locator("course-quiz#quiz2");

			await quiz1.locator("label").filter({ hasText: "True" }).click();
			await quiz1.locator("#Q2_text").click();
			await quiz1.locator("#Q2_text").fill("4");
			await quiz1.locator(".btn-submit").click();

			await quiz2.locator("label").filter({ hasText: "red" }).click();
			await quiz2.locator("label").filter({ hasText: "orange" }).click();
			await quiz2.locator("label").filter({ hasText: "yellow" }).click();
			await quiz2.locator("label").filter({ hasText: "0.3mg" }).click();
			await quiz2.locator(".btn-submit").click();

			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
			await page.locator("#next").click();
		});

		// === PAGE 2: multi_example2.html ===
		await test.step("multi_example2 page: play video, answer quizzes, advance", async () => {
			await expect(iframe.locator("h1")).toHaveText("Page 4");
			await page.waitForTimeout(500);

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
		});

		// === PAGE 3: finish.html ===
		await test.step("finish page: wait and trigger end screen", async () => {
			await expect(iframe.locator("h1")).toHaveText("Congrats!");
			await page.locator("#info-banner.warning").waitFor({ timeout: 15000 });
			await page.waitForTimeout(10000);
			await page.locator("#next").click();
		});

		// === END SCREEN ===
		await test.step("end screen: verify passed state", async () => {
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
});
