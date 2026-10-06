const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.loadCourseData: component validation", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should generate fallback ID for component with missing id", async () => {
		const result = await page.evaluate(() => {
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
									name: "test.html",
									type: "article",
									components: [
										{ type: "article" }
									]
								}
							]
						})
					});
				}
				return originalFetch(url);
			};

			state.data = { courseRules: {}, delta: { pagesState: [], currentPageIndex: 0 }, pages: [] };

			const loadPromise = state.loadCourseData();

			return loadPromise.then(() => {
				window.fetch = originalFetch;
				console.error = originalError;

				const page0Components = state.data.delta.pagesState[0]?.components || {};
				const componentKeys = Object.keys(page0Components);
				const hasUndefinedKey = "undefined" in page0Components;
				const hasAutoKey = componentKeys.some(k => k.startsWith("auto-"));

				return {
					componentKeys,
					hasUndefinedKey,
					hasAutoKey,
					errorLogged: consoleErrors.length > 0
				};
			});
		});

		expect(result.error).toBeUndefined();
		expect(result.hasUndefinedKey).toBe(false);
		expect(result.hasAutoKey).toBe(true);
	});

	test("should skip component with missing type and log error", async () => {
		const result = await page.evaluate(() => {
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
									name: "test.html",
									type: "article",
									components: [
										{ id: "comp1" }
									]
								}
							]
						})
					});
				}
				return originalFetch(url);
			};

			state.data = { courseRules: {}, delta: { pagesState: [], currentPageIndex: 0 }, pages: [] };

			const loadPromise = state.loadCourseData();

			return loadPromise.then(() => {
				window.fetch = originalFetch;
				console.error = originalError;

				const page0Components = state.data.delta.pagesState[0]?.components || {};
				const componentKeys = Object.keys(page0Components);

				return {
					componentKeys,
					typeErrorLogged: consoleErrors.some(e => e.includes("missing type")),
					errorCount: consoleErrors.length
				};
			});
		});

		expect(result.error).toBeUndefined();
		expect(result.typeErrorLogged).toBe(true);
		expect(result.componentKeys.length).toBe(0);
	});

	test("should skip quiz component with missing questions and log error", async () => {
		const result = await page.evaluate(() => {
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
									name: "test.html",
									type: "article",
									components: [
										{ id: "quiz1", type: "quiz" }
									]
								}
							]
						})
					});
				}
				return originalFetch(url);
			};

			state.data = { courseRules: {}, delta: { pagesState: [], currentPageIndex: 0 }, pages: [] };

			const loadPromise = state.loadCourseData();

			return loadPromise.then(() => {
				window.fetch = originalFetch;
				console.error = originalError;

				const page0Components = state.data.delta.pagesState[0]?.components || {};
				const componentKeys = Object.keys(page0Components);
				const quizError = consoleErrors.some(e => e.includes("missing questions"));

				return {
					componentKeys,
					quizErrorLogged: quizError,
					errorCount: consoleErrors.length
				};
			});
		});

		expect(result.error).toBeUndefined();
		expect(result.quizErrorLogged).toBe(true);
		expect(result.componentKeys.length).toBe(0);
	});

	test("should process valid component normally", async () => {
		const result = await page.evaluate(() => {
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
									name: "test.html",
									type: "article",
									components: [
										{ id: "valid-comp", type: "article" }
									]
								}
							]
						})
					});
				}
				return originalFetch(url);
			};

			state.data = { courseRules: {}, delta: { pagesState: [], currentPageIndex: 0 }, pages: [] };

			const loadPromise = state.loadCourseData();

			return loadPromise.then(() => {
				window.fetch = originalFetch;
				console.error = originalError;

				const page0Components = state.data.delta.pagesState[0]?.components || {};
				const componentKeys = Object.keys(page0Components);

				return {
					componentKeys,
					hasValidComp: "valid-comp" in page0Components,
					errorCount: consoleErrors.length
				};
			});
		});

		expect(result.error).toBeUndefined();
		expect(result.hasValidComp).toBe(true);
		expect(result.errorCount).toBe(0);
	});

	test("should handle quiz component with valid questions", async () => {
		const result = await page.evaluate(() => {
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
									name: "test.html",
									type: "article",
									components: [
										{
											id: "quiz1",
											type: "quiz",
											questions: [
												{ pointValue: 10 },
												{ pointValue: 20 }
											]
										}
									]
								}
							]
						})
					});
				}
				return originalFetch(url);
			};

			state.data = { courseRules: {}, delta: { pagesState: [], currentPageIndex: 0 }, pages: [] };

			const loadPromise = state.loadCourseData();

			return loadPromise.then(() => {
				window.fetch = originalFetch;
				console.error = originalError;

				const quizComp = state.data.delta.pagesState[0]?.components?.["quiz1"];

				return {
					hasQuiz: !!quizComp,
					hasMaxScore: quizComp?.maxScore === 30,
					hasScore: "score" in quizComp,
					hasAttempts: "attempts" in quizComp,
					errorCount: consoleErrors.length
				};
			});
		});

		expect(result.error).toBeUndefined();
		expect(result.hasQuiz).toBe(true);
		expect(result.hasMaxScore).toBe(true);
		expect(result.hasScore).toBe(true);
		expect(result.hasAttempts).toBe(true);
		expect(result.errorCount).toBe(0);
	});

	test("should initialize programming component state correctly", async () => {
		const result = await page.evaluate(() => {
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
									name: "test.html",
									type: "article",
									components: [
										{
											id: "prog1",
											type: "programming",
											starterCode: "// write code",
											language: "javascript"
										}
									]
								}
							]
						})
					});
				}
				return originalFetch(url);
			};

			state.data = { courseRules: {}, delta: { pagesState: [], currentPageIndex: 0 }, pages: [] };

			const loadPromise = state.loadCourseData();

			return loadPromise.then(() => {
				window.fetch = originalFetch;
				console.error = originalError;

				const progComp = state.data.delta.pagesState[0]?.components?.["prog1"];

				return {
					hasComponent: !!progComp,
					type: progComp?.type,
					hasCodeField: "codeContent" in (progComp || {}),
					hasTestResults: "testResults" in (progComp || {}),
					score: progComp?.score,
					maxScore: progComp?.maxScore,
					completed: progComp?.completed,
					errorCount: consoleErrors.length
				};
			});
		});

		expect(result.error).toBeUndefined();
		expect(result.hasComponent).toBe(true);
		expect(result.type).toBe("programming");
		// No code field at all: the learner's source is not saved course data,
		// so a fresh course state must not even have somewhere to put it.
		expect(result.hasCodeField).toBe(false);
		expect(result.hasTestResults).toBe(true);
		expect(result.score).toBe(0);
		expect(result.maxScore).toBe(0);
		expect(result.completed).toBe(false);
		expect(result.errorCount).toBe(0);
	});

	// Ticket #68. The parent derives a component's maxScore from the config
	// before any code runs, independently of what the component later reports.
	// Both sides have to apply the same rule or they disagree about the same
	// page: a case that declares no expected is not gradeable, so it is not a
	// point of the page's maximum either. Counting it here is what left the
	// inflated maximum in place even after the component stopped counting it.
	test("a programming page's maximum counts only cases that declare an expected", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const originalFetch = window.fetch;
			window.fetch = (url) => {
				if (url === "lessons/course_data.json") {
					return Promise.resolve({
						json: () => Promise.resolve({
							courseRules: {},
							pages: [
								{
									name: "test.html",
									type: "programming",
									components: [
										{
											id: "prog1",
											type: "programming",
											starterCode: "// write code",
											language: "javascript",
											expectedOutput: "done",
											testCases: [
												{ label: "Declared", functionName: "one", args: [], expected: 1 },
												{ label: "Absent", functionName: "two", args: [] },
												{ label: "Null", functionName: "three", args: [], expected: null },
											]

										}
									]
								}
							]
						})
					});
				}
				return originalFetch(url);
			};

			state.data = { courseRules: {}, delta: { pagesState: [], currentPageIndex: 0 }, pages: [] };

			return state.loadCourseData().then(() => {
				window.fetch = originalFetch;
				const page = state.data.delta.pagesState[0];
				return {
					componentMax: page?.components?.["prog1"]?.maxScore,
					// The page-level maximum is the sum the loader derived, carried
					// on the loaded page rather than on the delta.
					pageMax: state.data.pages?.[0]?.maxScore,
				};
			});
		});

		expect(result.error).toBeUndefined();
		// One expectedOutput plus one declared case; the absent and null cases
		// contribute nothing to either maximum.
		expect(result.componentMax).toBe(2);
		expect(result.pageMax).toBe(2);
	});
});