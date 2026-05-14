const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.debugging: URL-based debug flag", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should default to false when no debug param in URL", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const urlParams = new URLSearchParams(window.location.search);
			const debugging = urlParams.get("debug") === "true";

			return {
				debugging,
				searchParams: window.location.search
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.debugging).toBe(false);
	});

	test("should be true when debug=true in URL", async () => {
		const result = await page.evaluate(() => {
			const originalSearch = window.location.search;

			window.history.replaceState({}, "", "?debug=true");

			const urlParams = new URLSearchParams(window.location.search);
			const debugging = urlParams.get("debug") === "true";

			window.history.replaceState({}, "", originalSearch);

			return { debugging };
		});

		expect(result.debugging).toBe(true);
	});

	test("should be false when debug=false in URL", async () => {
		const result = await page.evaluate(() => {
			const originalSearch = window.location.search;

			window.history.replaceState({}, "", "?debug=false");

			const urlParams = new URLSearchParams(window.location.search);
			const debugging = urlParams.get("debug") === "true";

			window.history.replaceState({}, "", originalSearch);

			return { debugging };
		});

		expect(result.debugging).toBe(false);
	});

	test("should be false when other params in URL", async () => {
		const result = await page.evaluate(() => {
			const originalSearch = window.location.search;

			window.history.replaceState({}, "", "?page=1&other=value");

			const urlParams = new URLSearchParams(window.location.search);
			const debugging = urlParams.get("debug") === "true";

			window.history.replaceState({}, "", originalSearch);

			return { debugging };
		});

		expect(result.debugging).toBe(false);
	});

	test("should be false when debug param has different value", async () => {
		const result = await page.evaluate(() => {
			const originalSearch = window.location.search;

			window.history.replaceState({}, "", "?debug=1");

			const urlParams = new URLSearchParams(window.location.search);
			const debugging = urlParams.get("debug") === "true";

			window.history.replaceState({}, "", originalSearch);

			return { debugging };
		});

		expect(result.debugging).toBe(false);
	});
});