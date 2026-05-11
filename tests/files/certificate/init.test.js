const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("init", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should store state reference in _state", async () => {
		const result = await page.evaluate(() => {
			const mockState = { foo: "bar" };

			certificate.init(mockState);

			return {
				stateStored: certificate._state === mockState,
				stateHasFoo: certificate._state.foo === "bar",
			};
		});

		expect(result.stateStored).toBe(true);
		expect(result.stateHasFoo).toBe(true);
	});

	test("should overwrite _state on re-init", async () => {
		const result = await page.evaluate(() => {
			const firstState = { id: 1 };
			const secondState = { id: 2 };

			certificate.init(firstState);
			certificate.init(secondState);

			return {
				stateChanged: certificate._state !== firstState,
				newStateSet: certificate._state === secondState,
				newStateId: certificate._state.id,
			};
		});

		expect(result.stateChanged).toBe(true);
		expect(result.newStateSet).toBe(true);
		expect(result.newStateId).toBe(2);
	});
});