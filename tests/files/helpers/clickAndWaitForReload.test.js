const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");
const { clickAndWaitForReload } = require("../../helpers/navigation.js");

test.describe("clickAndWaitForReload", () => {
	let page;

	test.afterEach(async () => {
		if (page) await page.close();
	});

	// ui._onRefresh defers window.location.reload() behind an async save.
	// Stretching that save makes the window in which the pre-reload document
	// still reports state.initialized === true observable to the test.
	async function slowDownRefreshSave() {
		await page.evaluate(() => {
			const originalSave = state.save.bind(state);
			state.save = async () => {
				await new Promise((resolve) => setTimeout(resolve, 800));
				return originalSave();
			};
		});
	}

	test("resolves only once the freshly loaded document is live", async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);

		const refreshButton = page.locator("button.help-action-btn", {
			hasText: "Refresh This Web Page",
		});

		for (let i = 0; i < 3; i++) {
			await page.locator("#help-btn").click();
			await expect(page.locator("#help-overlay")).toBeVisible();

			await slowDownRefreshSave();
			await page.evaluate(() => {
				window.__docMarker = "pre-reload";
			});

			await clickAndWaitForReload(page, refreshButton);

			const marker = await page.evaluate(() => window.__docMarker);
			expect(marker).toBeUndefined();

			const initialized = await page.evaluate(() => state.initialized);
			expect(initialized).toBe(true);
		}
	});
});
