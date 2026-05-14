const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("utils.generatePasscode", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should return a non-empty string", async () => {
		const result = await page.evaluate(() => {
			if (typeof utils === "undefined") return { error: "utils not defined" };
			return { value: utils.generatePasscode() };
		});
		expect(result.error).toBeUndefined();
		expect(typeof result.value).toBe("string");
		expect(result.value.length).toBeGreaterThan(0);
	});

	test("should return different values on successive calls", async () => {
		const result = await page.evaluate(() => {
			if (typeof utils === "undefined") return { error: "utils not defined" };
			const a = utils.generatePasscode();
			const b = utils.generatePasscode();
			return { a, b, same: a === b };
		});
		expect(result.error).toBeUndefined();
		expect(result.same).toBe(false);
	});
});
