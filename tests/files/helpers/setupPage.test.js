const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("setupPage readiness", () => {
	let page;

	test.afterEach(async () => {
		if (page) await page.close();
	});

	test("state.handleMessage is callable immediately after setupPage resolves", async ({ browser }) => {
		page = await browser.newPage();

		// Stall state.init() inside loadCourseData so the window between
		// "script globals exist" and "state finished initializing" is observable.
		await page.route("**/lessons/course_data.json", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 700));
			await route.continue();
		});

		await setupPage(page);

		const result = await page.evaluate(() => {
			try {
				state.pageAPISecret = "TEST_SECRET";
				state.handleMessage({
					data: {
						type: "GET_PROGRAMMING_DATA",
						message: { id: "prog1", value: "" },
						code: "TEST_SECRET",
						nonce: Date.now(),
					},
					origin: window.location.origin,
				});
				return { ok: true };
			} catch (error) {
				return { ok: false, error: String(error) };
			}
		});

		expect(result.error).toBeUndefined();
		expect(result.ok).toBe(true);
	});

	test("setupPage fails fast with the real cause when course data cannot load", async ({ browser }) => {
		// Headroom so the helper's own wait can surface as a rejection instead
		// of the test timing out first.
		test.setTimeout(45000);

		const t0 = Date.now();
		page = await browser.newPage();
		await page.route("**/lessons/course_data.json", (route) =>
			route.fulfill({ status: 404, body: "not found" }),
		);
		let failure = null;
		try {
			await setupPage(page);
		} catch (error) {
			failure = error;
		}
		const elapsed = Date.now() - t0;

		expect(failure).not.toBeNull();
		// Fails fast rather than waiting out the test timeout...
		expect(elapsed).toBeLessThan(5000);
		// ...and names the actual cause, not just our own "it failed" prefix.
		expect(failure.message).toMatch(/Failed to load course data|course_data\.json|TypeError/);
	});
});
