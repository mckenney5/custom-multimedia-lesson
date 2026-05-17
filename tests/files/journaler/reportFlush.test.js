const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("journaler.report() flushes _eventBuffer", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should include buffered events in report output", async () => {
		const result = await page.evaluate(() => {
			journaler._currentLog = [];
			journaler._eventBuffer = [];

			journaler.log("PAGE_COMPLETE", 2);
			journaler.log("COURSE_COMPLETE", "pass");

			const report = journaler.report();
			const eventNames = report.slice(1).map(r => r[2]);

			return {
				hasPageComplete: eventNames.includes("PAGE_COMPLETE"),
				hasCourseComplete: eventNames.includes("COURSE_COMPLETE"),
				rowCount: report.length - 1,
			};
		});

		expect(result.hasPageComplete).toBe(true);
		expect(result.hasCourseComplete).toBe(true);
		expect(result.rowCount).toBe(2);
	});

	test("should clear event buffer after report", async () => {
		const result = await page.evaluate(() => {
			journaler._currentLog = [];
			journaler._eventBuffer = [];

			journaler.log("PAGE_COMPLETE", 2);
			journaler.report();

			return journaler._eventBuffer.length;
		});

		expect(result).toBe(0);
	});
});
