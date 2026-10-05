const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.loadCourseData: requireSubmission fail-closed diagnostic", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("console.errors naming the page when requireSubmission declares zero submission components", async () => {
		const result = await page.evaluate(async () => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const consoleErrors = [];
			const originalError = console.error;
			console.error = (...args) => consoleErrors.push(args.join(" "));

			const originalFetch = window.fetch;
			window.fetch = (url) => {
				if (url === "lessons/course_data.json") {
					return Promise.resolve({
						json: () => Promise.resolve({
							courseRules: {},
							pages: [
								{
									name: "no-sub.html",
									completionRules: { watchTime: 0, score: 0, scrolled: false, videoProgress: 0, requireSubmission: true },
									components: [{ id: "art1", type: "article" }],
								},
								{
									name: "with-sub.html",
									completionRules: { watchTime: 0, score: 0, scrolled: false, videoProgress: 0, requireSubmission: true },
									components: [{ id: "quiz1", type: "quiz", questions: [{ pointValue: 1 }] }],
								},
							],
						}),
					});
				}
				return originalFetch(url);
			};

			state.data = { courseRules: {}, delta: { pagesState: [], currentPageIndex: 0 }, pages: [] };

			try {
				await state.loadCourseData();
			} finally {
				window.fetch = originalFetch;
				console.error = originalError;
			}

			return {
				pageCount: state.data.pages.length,
				namedBadPage: consoleErrors.some(e => e.includes("no-sub.html")),
				mentionsRequireSubmission: consoleErrors.some(e => e.includes("requireSubmission")),
				namesGoodPage: consoleErrors.some(e => e.includes("with-sub.html")),
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.pageCount).toBe(2);
		expect(result.namedBadPage).toBe(true);
		expect(result.mentionsRequireSubmission).toBe(true);
		expect(result.namesGoodPage).toBe(false);
	});

	test("every shipped lesson page still passes checkIfComplete with a fully completed learner", async () => {
		// Re-verification of the fail-closed blast radius: a page is only
		// bricked by the new rule when it requires a submission and declares
		// none. For every real page, build the most complete learner delta
		// possible and require a pass.
		const result = await page.evaluate(async () => {
			if (typeof state === "undefined") return { error: "state not defined" };
			if (typeof completion === "undefined") return { error: "completion not defined" };

			state.data = { courseRules: {}, delta: { pagesState: [], currentPageIndex: 0 }, pages: [] };
			await state.loadCourseData();

			const audits = state.data.pages.map((page, i) => {
				const rules = page.completionRules || {};
				const pageState = state.data.delta.pagesState[i];
				const submissionCount = (page.components || [])
					.filter(c => c.type === "quiz" || c.type === "programming").length;
				const delta = {
					watchTime: rules.watchTime || 0,
					scrolled: true,
					score: page.maxScore,
					videoProgress: rules.videoProgress || 0,
					components: Object.fromEntries(
						Object.entries(pageState.components).map(([id, cs]) => [id, { ...cs, completed: true }]),
					),
				};
				return {
					name: page.name,
					requireSubmission: rules.requireSubmission === true,
					submissionCount,
					passes: completion.checkIfComplete(page, delta),
				};
			});

			return { audits };
		});

		expect(result.error).toBeUndefined();
		expect(result.audits.length).toBeGreaterThan(0);
		for (const audit of result.audits) {
			expect(audit.passes, `${audit.name} should pass checkIfComplete`).toBe(true);
			if (audit.requireSubmission) {
				expect(audit.submissionCount, `${audit.name} requires a submission so it must declare one`).toBeGreaterThan(0);
			}
		}
	});
});
