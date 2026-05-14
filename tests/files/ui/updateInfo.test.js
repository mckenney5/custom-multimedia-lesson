const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("updateInfo", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should render page count and progress percentage", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBar) ui.init();
			ui.updateInfo({ currentPageIndex: 0, pageCount: 5, progress: 0 });
			return {
				text: ui.infoBar.innerText,
				progressBar: ui.infoBar.querySelector("#info-bar-fill"),
			};
		});

		expect(result.text).toContain("Page 1 of 5");
		expect(result.text).toContain("0% Complete");
		expect(result.progressBar).not.toBeNull();
	});

	test("should render correct progress at 50%", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBar) ui.init();
			ui.updateInfo({ currentPageIndex: 1, pageCount: 5, progress: 2 });
			return {
				text: ui.infoBar.innerText,
				width: ui.infoBar.querySelector("#info-bar-fill").style.width,
			};
		});

		expect(result.text).toContain("Page 2 of 5");
		expect(result.text).toContain("50% Complete");
		expect(result.width).toBe("50%");
	});

	test("should render 100% when all pages complete", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBar) ui.init();
			ui.updateInfo({ currentPageIndex: 4, pageCount: 5, progress: 4 });
			return {
				text: ui.infoBar.innerText,
				width: ui.infoBar.querySelector("#info-bar-fill").style.width,
			};
		});

		expect(result.text).toContain("100% Complete");
		expect(result.width).toBe("100%");
	});

	test("should handle single-page course without divide-by-zero", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBar) ui.init();
			ui.updateInfo({ currentPageIndex: 0, pageCount: 1, progress: 0 });
			return {
				text: ui.infoBar.innerText,
				width: ui.infoBar.querySelector("#info-bar-fill").style.width,
			};
		});

		expect(result.text).toContain("Page 1 of 1");
		expect(result.width).toBe("0%");
	});

	test("should render multiple updates correctly", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBar) ui.init();
			ui.updateInfo({ currentPageIndex: 0, pageCount: 10, progress: 0 });
			const first = ui.infoBar.innerText;
			ui.updateInfo({ currentPageIndex: 4, pageCount: 10, progress: 5 });
			const second = ui.infoBar.innerText;
			return { first, second };
		});

		expect(result.first).toContain("Page 1 of 10");
		expect(result.first).toContain("0% Complete");
		expect(result.second).toContain("Page 5 of 10");
		expect(result.second).toContain("56% Complete");
	});
});
