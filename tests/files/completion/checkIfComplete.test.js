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

	test("requireSubmission blocks a page with an incomplete programming component", async () => {
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
					{ id: "prog1", type: "programming" },
				],
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				components: {
					prog1: { completed: false },
				},
			};

			return { result: completion.checkIfComplete(page, pageDelta) };
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(false);
	});

	test("requireSubmission is satisfied when the programming component is completed", async () => {
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
					{ id: "prog1", type: "programming" },
				],
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				components: {
					prog1: { completed: true },
				},
			};

			return { result: completion.checkIfComplete(page, pageDelta) };
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(true);
	});

	test("requireSubmission blocks a page whose programming component has no recorded state", async () => {
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
					{ id: "prog1", type: "programming" },
				],
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				components: {},
			};

			return { result: completion.checkIfComplete(page, pageDelta) };
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(false);
	});

	test("requireSubmission fails closed when the page has no components key", async () => {
		// DECIDED (ticket #62 / ADR 0006): fail closed. The fixture omits the
		// `components` key entirely, so `(page.components || [])` yields [] and
		// the gate must refuse to pass on an empty submission list.
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
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				components: {},
			};

			return { result: completion.checkIfComplete(page, pageDelta) };
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(false);
	});

	test("requireSubmission fails closed when no declared component is a submission", async () => {
		// DECIDED (ticket #62 / ADR 0006): fail closed. The fixture declares a
		// components array, but its only entry is an article, so `filter`
		// returns [] and the gate must refuse to pass on that too.
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
					{ id: "art1", type: "article" },
				],
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
				components: {},
			};

			return { result: completion.checkIfComplete(page, pageDelta) };
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(false);
	});

	test("requireSubmission fails closed when the page delta carries no component state", async () => {
		// The page declares a quiz, so the submission list is non-empty and the
		// gate must read component state out of the delta. When the delta has
		// no `components` key there is nothing to read, so the page is not
		// complete — it must degrade like ui.showPageHelp's row, not throw.
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
				],
			};
			const pageDelta = {
				watchTime: 0,
				score: 0,
				scrolled: false,
				videoProgress: 0,
			};

			try {
				return { result: completion.checkIfComplete(page, pageDelta) };
			} catch (e) {
				return { threw: e.message };
			}
		});

		expect(result.threw).toBeUndefined();
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
