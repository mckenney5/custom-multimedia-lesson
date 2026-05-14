const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("completion.calculateOverallGrade", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should return 1.0 ratio when all points earned on single page", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const pages = [{ maxScore: 100 }];
			const pagesState = [{ score: 100 }];

			return completion.calculateOverallGrade(pages, pagesState);
		});

		expect(result.error).toBeUndefined();
		expect(result.ratio).toBe(1);
		expect(result.earnedScore).toBe(100);
		expect(result.maxScore).toBe(100);
	});

	test("should compute correct ratio across multiple pages", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const pages = [
				{ maxScore: 100 },
				{ maxScore: 50 },
				{ maxScore: 50 },
			];
			const pagesState = [
				{ score: 80 },
				{ score: 40 },
				{ score: 25 },
			];

			return completion.calculateOverallGrade(pages, pagesState);
		});

		expect(result.error).toBeUndefined();
		expect(result.ratio).toBeCloseTo(0.725, 3);
		expect(result.earnedScore).toBe(145);
		expect(result.maxScore).toBe(200);
	});

	test("should return zeros when all maxScores are zero", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const pages = [
				{ maxScore: 0 },
				{ maxScore: 0 },
			];
			const pagesState = [
				{ score: 10 },
				{ score: 20 },
			];

			return completion.calculateOverallGrade(pages, pagesState);
		});

		expect(result.error).toBeUndefined();
		expect(result.ratio).toBe(0);
		expect(result.earnedScore).toBe(0);
		expect(result.maxScore).toBe(0);
	});

	test("should return 0 ratio when no points earned", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const pages = [
				{ maxScore: 100 },
				{ maxScore: 50 },
			];
			const pagesState = [
				{ score: 0 },
				{ score: 0 },
			];

			return completion.calculateOverallGrade(pages, pagesState);
		});

		expect(result.error).toBeUndefined();
		expect(result.ratio).toBe(0);
		expect(result.earnedScore).toBe(0);
		expect(result.maxScore).toBe(150);
	});

	test("should handle single page with partial score", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const pages = [{ maxScore: 200 }];
			const pagesState = [{ score: 150 }];

			return completion.calculateOverallGrade(pages, pagesState);
		});

		expect(result.error).toBeUndefined();
		expect(result.ratio).toBe(0.75);
		expect(result.earnedScore).toBe(150);
		expect(result.maxScore).toBe(200);
	});
});
