const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("CourseComponent base render()", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
		await page.addScriptTag({ path: "../src/internal/components.js" });
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should set innerHTML to Loading...", async () => {
		const result = await page.evaluate(() => {
			const el = document.createElement("div");
			CourseComponent.prototype.render.call(el);
			return el.innerHTML;
		});
		expect(result).toBe("Loading...");
	});

	test("should warn that render is not implemented", async () => {
		const result = await page.evaluate(() => {
			const el = document.createElement("div");
			const warnMessages = [];
			const originalWarn = console.warn;
			console.warn = function (msg) {
				warnMessages.push(msg);
			};
			CourseComponent.prototype.render.call(el);
			console.warn = originalWarn;
			return warnMessages;
		});
		expect(result.length).toBe(1);
		expect(result[0]).toContain("render() method not implemented");
	});
});
