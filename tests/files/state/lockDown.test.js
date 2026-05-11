const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state.lockDown: effective lockdown", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should set onbeforeunload with return string to actually prevent unload", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.lockDown();

			const beforeUnloadHandler = window.onbeforeunload;
			if (!beforeUnloadHandler) return { hasHandler: false };

			const returnValue = beforeUnloadHandler();

			return {
				hasHandler: true,
				returnValue: returnValue,
				returnValueType: typeof returnValue,
				returnValueLength: returnValue ? returnValue.length : 0
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.hasHandler).toBe(true);
		expect(result.returnValueType).toBe("string");
		expect(result.returnValueLength).toBeGreaterThan(0);
	});

	test("should null out window.state global reference", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const stateExistedBefore = typeof window.state !== "undefined" && window.state !== null;

			state.lockDown();

			return {
				stateExistedBefore,
				stateIsNull: window.state === null,
				stateIsUndefined: window.state === undefined
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.stateIsNull).toBe(true);
	});

	test("should null out window.journaler global reference", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined" || typeof journaler === "undefined") return { error: "state or journaler not defined" };

			const journalerExistedBefore = typeof window.journaler !== "undefined" && window.journaler !== null;

			state.lockDown();

			return {
				journalerExistedBefore,
				journalerIsNull: window.journaler === null,
				journalerIsUndefined: window.journaler === undefined
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.journalerIsNull).toBe(true);
	});

	test("should null out window.lms global reference", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined" || typeof lms === "undefined") return { error: "state or lms not defined" };

			const lmsExistedBefore = typeof window.lms !== "undefined" && window.lms !== null;

			state.lockDown();

			return {
				lmsExistedBefore,
				lmsIsNull: window.lms === null,
				lmsIsUndefined: window.lms === undefined
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.lmsIsNull).toBe(true);
	});

	test("should set pauseSave to true to prevent saves", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			state.lockDown();

			return {
				pauseSave: state.pauseSave
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.pauseSave).toBe(true);
	});

	test("should disable all buttons on the page", async () => {
		const result = await page.evaluate(() => {
			if (typeof state === "undefined") return { error: "state not defined" };

			const existingButtons = Array.from(document.querySelectorAll("button"));

			state.lockDown();

			const disabledButtons = existingButtons.filter(btn => btn.disabled);

			return {
				totalButtons: existingButtons.length,
				disabledButtons: disabledButtons.length,
				allDisabled: existingButtons.length > 0 && disabledButtons.length === existingButtons.length
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.totalButtons).toBeGreaterThan(0);
		expect(result.allDisabled).toBe(true);
	});
});