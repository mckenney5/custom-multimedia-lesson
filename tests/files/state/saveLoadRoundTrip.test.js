const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state save/load round-trip: currentPageIndex", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should preserve currentPageIndex through full save/load via localStorage", async () => {
		const result = await page.evaluate(async () => {
			state.data.pages = [
				{ name: "page0", path: "lessons/page0.html" },
				{ name: "page1", path: "lessons/page1.html" },
				{ name: "page2", path: "lessons/page2.html" },
				{ name: "finish", path: "lessons/finish.html" },
			];
			state.data.delta.pagesState = state.data.pages.map(() => ({
				completed: false, scrolled: false, score: 0,
				watchTime: 0, attempts: 0, videoProgress: 0,
				userAnswers: {}, components: {},
			}));
			state.data.delta.currentPageIndex = 3;
			state.data.delta.progress = 3;
			state.data.delta.totalCourseSeconds = 600;

			await state.save();

			state.data.delta.currentPageIndex = 0;
			state.data.delta.progress = 0;
			state.data.delta.totalCourseSeconds = 0;

			await state.loadSave();

			return {
				currentPageIndex: state.data.delta.currentPageIndex,
				progress: state.data.delta.progress,
				totalCourseSeconds: state.data.delta.totalCourseSeconds,
			};
		});

		expect(result.currentPageIndex).toBe(3);
		expect(result.progress).toBe(3);
	});

	test("should preserve currentPageIndex after page reload (sync onbeforeunload save)", async () => {
		const result = await page.evaluate(async () => {
			state.data.pages = [
				{ name: "page0", path: "lessons/page0.html" },
				{ name: "page1", path: "lessons/page1.html" },
				{ name: "page2", path: "lessons/page2.html" },
				{ name: "finish", path: "lessons/finish.html" },
			];
			state.data.delta.pagesState = state.data.pages.map(() => ({
				completed: false, scrolled: false, score: 0,
				watchTime: 0, attempts: 0, videoProgress: 0,
				userAnswers: {}, components: {},
			}));

			state.data.delta.currentPageIndex = 2;
			state.data.delta.progress = 3;
			state.data.delta.totalCourseSeconds = 600;
			await state.save();

			state.data.delta.currentPageIndex = 3;

			return { saved: true };
		});

		expect(result.saved).toBe(true);

		await page.reload();
		await page.waitForFunction(() =>
			typeof state !== "undefined" && state.initialized,
		);

		const pageIdx = await page.evaluate(() => state.data.delta.currentPageIndex);
		expect(pageIdx).toBe(3);
	});
});
