const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("completion.checkCourseCompletion (pure query)", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should return true when time and grade requirements are met and all pages complete", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const courseRules = {
				minimumMinutes: 1,
				minimumGrade: 0.7,
				studentsCanFail: false,
			};
			const totalCourseSeconds = 60;
			const pages = [{ maxScore: 100 }];
			const pagesState = [{ score: 80, completed: true }];

			return {
				result: completion.checkCourseCompletion(courseRules, totalCourseSeconds, pages, pagesState),
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(true);
	});

	test("should return false when time requirement is not met", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const courseRules = {
				minimumMinutes: 10,
				minimumGrade: 0,
				studentsCanFail: false,
			};
			const totalCourseSeconds = 60;
			const pages = [{ maxScore: 0 }];
			const pagesState = [{ score: 0, completed: true }];

			return {
				result: completion.checkCourseCompletion(courseRules, totalCourseSeconds, pages, pagesState),
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(false);
	});

	test("should return false when grade is too low and students cannot fail", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const courseRules = {
				minimumMinutes: 0,
				minimumGrade: 0.8,
				studentsCanFail: false,
			};
			const totalCourseSeconds = 0;
			const pages = [{ maxScore: 100 }];
			const pagesState = [{ score: 50, completed: true }];

			return {
				result: completion.checkCourseCompletion(courseRules, totalCourseSeconds, pages, pagesState),
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(false);
	});

	test("should return true when grade is too low but studentsCanFail is true", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const courseRules = {
				minimumMinutes: 0,
				minimumGrade: 0.8,
				studentsCanFail: true,
			};
			const totalCourseSeconds = 0;
			const pages = [{ maxScore: 100 }];
			const pagesState = [{ score: 50, completed: true }];

			return {
				result: completion.checkCourseCompletion(courseRules, totalCourseSeconds, pages, pagesState),
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(true);
	});

	test("should return false when not all pages are complete", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const courseRules = {
				minimumMinutes: 0,
				minimumGrade: 0.8,
				studentsCanFail: false,
			};
			const totalCourseSeconds = 0;
			const pages = [
				{ maxScore: 100 },
				{ maxScore: 100 },
			];
			const pagesState = [
				{ score: 80, completed: true },
				{ score: 0, completed: false },
			];

			return {
				result: completion.checkCourseCompletion(courseRules, totalCourseSeconds, pages, pagesState),
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.result).toBe(false);
	});

	test("should not mutate pagesState (pure query)", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const courseRules = {
				minimumMinutes: 1,
				minimumGrade: 0.5,
				studentsCanFail: false,
			};
			const totalCourseSeconds = 60;
			const pages = [
				{ maxScore: 100 },
				{ maxScore: 100 },
			];
			const pagesState = [
				{ score: 100, completed: true },
				{ score: 100, completed: false },
			];

			const before = pagesState[1].completed;
			completion.checkCourseCompletion(courseRules, totalCourseSeconds, pages, pagesState);
			const after = pagesState[1].completed;

			return { before, after, unchanged: before === after };
		});

		expect(result.error).toBeUndefined();
		expect(result.unchanged).toBe(true);
	});
});

test.describe("completion.finalizeCourse (explicit action)", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should mark last page as completed when time and grade are met", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const courseRules = {
				minimumMinutes: 1,
				minimumGrade: 0.5,
				studentsCanFail: false,
			};
			const totalCourseSeconds = 60;
			const pages = [
				{ maxScore: 100 },
				{ maxScore: 100 },
			];
			const pagesState = [
				{ score: 100, completed: true },
				{ score: 100, completed: false },
			];

			completion.finalizeCourse(courseRules, totalCourseSeconds, pages, pagesState);

			return {
				lastPageCompleted: pagesState[1].completed,
				firstPageStillCompleted: pagesState[0].completed,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.lastPageCompleted).toBe(true);
		expect(result.firstPageStillCompleted).toBe(true);
	});

	test("should not mark last page completed when time requirement is not met", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const courseRules = {
				minimumMinutes: 10,
				minimumGrade: 0,
				studentsCanFail: false,
			};
			const totalCourseSeconds = 0;
			const pages = [
				{ maxScore: 0 },
				{ maxScore: 0 },
			];
			const pagesState = [
				{ score: 0, completed: true },
				{ score: 0, completed: false },
			];

			completion.finalizeCourse(courseRules, totalCourseSeconds, pages, pagesState);

			return {
				lastPageCompleted: pagesState[1].completed,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.lastPageCompleted).toBe(false);
	});

	test("should not mark last page when grade is too low and students cannot fail", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const courseRules = {
				minimumMinutes: 0,
				minimumGrade: 0.9,
				studentsCanFail: false,
			};
			const totalCourseSeconds = 0;
			const pages = [
				{ maxScore: 100 },
				{ maxScore: 100 },
			];
			const pagesState = [
				{ score: 100, completed: true },
				{ score: 10, completed: false },
			];

			completion.finalizeCourse(courseRules, totalCourseSeconds, pages, pagesState);

			return {
				lastPageCompleted: pagesState[1].completed,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.lastPageCompleted).toBe(false);
	});

	test("should mark last page completed when grade is low but studentsCanFail is true", async () => {
		const result = await page.evaluate(() => {
			if (typeof completion === "undefined") return { error: "completion not defined" };

			const courseRules = {
				minimumMinutes: 0,
				minimumGrade: 0.9,
				studentsCanFail: true,
			};
			const totalCourseSeconds = 0;
			const pages = [
				{ maxScore: 100 },
				{ maxScore: 100 },
			];
			const pagesState = [
				{ score: 100, completed: true },
				{ score: 10, completed: false },
			];

			completion.finalizeCourse(courseRules, totalCourseSeconds, pages, pagesState);

			return {
				lastPageCompleted: pagesState[1].completed,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.lastPageCompleted).toBe(true);
	});
});
