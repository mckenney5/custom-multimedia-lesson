const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("CourseProgramming connectedCallback()", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
		await page.addScriptTag({ path: "../src/vendor/codemirror/lib/codemirror.js" });
		await page.addScriptTag({ path: "../src/vendor/codemirror/mode/javascript/javascript.js" });
		await page.addScriptTag({ path: "../src/internal/components.js" });
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should call super.connectedCallback()", async () => {
		const result = await page.evaluate(() => {
			let superCalled = false;
			const originalSuper = CourseComponent.prototype.connectedCallback;
			CourseComponent.prototype.connectedCallback = function() {
				superCalled = true;
				return originalSuper.apply(this, arguments);
			};
			const prog = document.createElement("course-programming");
			prog.connectedCallback();
			CourseComponent.prototype.connectedCallback = originalSuper;
			return superCalled;
		});
		expect(result).toBe(true);
	});

	test("should invoke send() with GET_PROGRAMMING_DATA", async () => {
		const result = await page.evaluate(() => {
			let sentType = null;
			const prog = document.createElement("course-programming");
			prog.send = (type) => { sentType = type; };
			prog.connectedCallback();
			return sentType;
		});
		expect(result).toBe("GET_PROGRAMMING_DATA");
	});

	test("should create bound handler for programming-data event", async () => {
		const result = await page.evaluate(() => {
			const prog = document.createElement("course-programming");
			prog.connectedCallback();
			return {
				hasBoundHandler: typeof prog._boundProgHandler === "function",
			};
		});
		expect(result.hasBoundHandler).toBe(true);
	});

	test("should add programming-data event listener", async () => {
		const result = await page.evaluate(() => {
			let listenerAdded = false;
			const originalAdd = window.addEventListener;
			window.addEventListener = function(type) {
				if (type === "programming-data") listenerAdded = true;
			};
			const prog = document.createElement("course-programming");
			prog.connectedCallback();
			window.addEventListener = originalAdd;
			return listenerAdded;
		});
		expect(result).toBe(true);
	});
});
