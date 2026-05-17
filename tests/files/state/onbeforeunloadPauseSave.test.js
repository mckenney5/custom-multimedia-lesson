const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state onbeforeunload pauseSave guard", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should skip sync save when pauseSave is true", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.data.pages = [{ name: "test", path: "lessons/test.html" }];
			state.data.delta.pagesState = [{
				completed: false, scrolled: false, score: 0,
				watchTime: 0, attempts: 0, videoProgress: 0,
				userAnswers: {}, components: {},
			}];

			let saveDataCalled = false;
			const origSaveData = lms.saveData;
			lms.saveData = () => { saveDataCalled = true; };

			state.pauseSave = true;

			const returnValue = window.onbeforeunload();

			lms.saveData = origSaveData;

			return {
				saveDataCalled,
				returnValue,
				returnValueType: typeof returnValue,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.saveDataCalled).toBe(false);
		expect(result.returnValue).toBeUndefined();
	});
});
