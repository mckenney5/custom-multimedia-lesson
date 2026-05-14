const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("completion.checkIfComplete", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should return true when all basic rules are met", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const page = {
				maxScore: 100,
				completionRules: {
					watchTime: 30,
					score: 0.7,
					scrolled: false,
					videoProgress: 0,
				},
			};
			const pageDelta = {
				watchTime: 30,
				score: 80,
				scrolled: false,
				videoProgress: 1,
			};

			return { result: completion.checkIfComplete(page, pageDelta) };
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(true);
	});

	test("should return false when watchTime is insufficient", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const page = {
				maxScore: 100,
				completionRules: {
					watchTime: 60,
					score: 0,
					scrolled: false,
					videoProgress: 0,
				},
			};
			const pageDelta = {
				watchTime: 30,
				score: 0,
				scrolled: false,
				videoProgress: 0,
			};

			return { result: completion.checkIfComplete(page, pageDelta) };
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(false);
	});

	test("should return false when score is below threshold", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const page = {
				maxScore: 100,
				completionRules: {
					watchTime: 0,
					score: 0.8,
					scrolled: false,
					videoProgress: 0,
				},
			};
			const pageDelta = {
				watchTime: 0,
				score: 50,
				scrolled: false,
				videoProgress: 0,
			};

			return { result: completion.checkIfComplete(page, pageDelta) };
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(false);
	});

	test("should return false when scrolled is required but not done", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const page = {
				maxScore: 0,
				completionRules: {
					watchTime: 0,
					score: 0,
					scrolled: true,
					videoProgress: 0,
				},
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
			};

			return { result: completion.checkIfComplete(page, pageDelta) };
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(false);
	});

	test("should return false when videoProgress is below threshold", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const page = {
				maxScore: 0,
				completionRules: {
					watchTime: 0,
					score: 0,
					scrolled: false,
					videoProgress: 0.9,
				},
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0.5,
			};

			return { result: completion.checkIfComplete(page, pageDelta) };
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(false);
	});

	test("should return true when requireSubmission is met with all quizzes completed", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const page = {
				maxScore: 0,
				completionRules: {
					watchTime: 0,
					score: 0,
					scrolled: false,
					videoProgress: 0,
					requireSubmission: true,
				},
				components: [
					{ id: "quiz1", type: "quiz" },
					{ id: "quiz2", type: "quiz" },
				],
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				components: {
					quiz1: { completed: true },
					quiz2: { completed: true },
				},
			};

			return { result: completion.checkIfComplete(page, pageDelta) };
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(true);
	});

	test("should return false when requireSubmission but a quiz is incomplete", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const page = {
				maxScore: 0,
				completionRules: {
					watchTime: 0,
					score: 0,
					scrolled: false,
					videoProgress: 0,
					requireSubmission: true,
				},
				components: [
					{ id: "quiz1", type: "quiz" },
					{ id: "quiz2", type: "quiz" },
				],
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				components: {
					quiz1: { completed: true },
					quiz2: { completed: false },
				},
			};

			return { result: completion.checkIfComplete(page, pageDelta) };
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(false);
	});

	test("should handle maxScore of 0 gracefully without crashing", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const page = {
				maxScore: 0,
				completionRules: {
					watchTime: 0,
					score: 0,
					scrolled: false,
					videoProgress: 0,
				},
			};
			const pageDelta = {
				watchTime: 0,
				score: 50,
				scrolled: false,
				videoProgress: 0,
			};

			try {
				const isComplete = completion.checkIfComplete(page, pageDelta);
				return {
					success: true,
					returnedBoolean: typeof isComplete === "boolean",
					result: isComplete,
				};
			} catch (e) {
				return { success: false, error: e.message };
			}
		});

		expect(result.error).toBeUndefined();
		expect(result.success).toBe(true);
		expect(result.returnedBoolean).toBe(true);
	});
});
