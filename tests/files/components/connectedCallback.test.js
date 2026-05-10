const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("CourseComponent connectedCallback()", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
		await page.addScriptTag({ path: "../src/internal/components.js" });
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should set rendered to true after connectedCallback", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.connectedCallback();
			return video.rendered;
		});
		expect(result).toBe(true);
	});

	test("should call render during connectedCallback", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			let renderCalled = false;
			const originalRender = video.render;
			video.render = function () {
				renderCalled = true;
				return originalRender.apply(this, arguments);
			};
			video.connectedCallback();
			return renderCalled;
		});
		expect(result).toBe(true);
	});

	test("should call attachListeners during connectedCallback", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			let attachCalled = false;
			const originalAttach = video.attachListeners;
			video.attachListeners = function () {
				attachCalled = true;
				return originalAttach.apply(this, arguments);
			};
			video.connectedCallback();
			return attachCalled;
		});
		expect(result).toBe(true);
	});

	test("should not render on second connectedCallback call (guard clause)", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			let renderCallCount = 0;
			const originalRender = video.render;
			video.render = function () {
				renderCallCount++;
				return originalRender.apply(this, arguments);
			};
			video.connectedCallback();
			video.connectedCallback();
			return renderCallCount;
		});
		expect(result).toBe(1);
	});

	test("should set _boundDataHandler after connectedCallback", async () => {
		const result = await page.evaluate(() => {
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.connectedCallback();
			return typeof video._boundDataHandler === "function";
		});
		expect(result).toBe(true);
	});

	test("should add student-data event listener via window.addEventListener", async () => {
		const result = await page.evaluate(() => {
			let listenerAdded = false;
			const originalAdd = window.addEventListener;
			window.addEventListener = function (type) {
				if (type === "student-data") listenerAdded = true;
				return originalAdd.apply(this, arguments);
			};
			const video = document.createElement("course-video");
			video.setAttribute("src", "test.mp4");
			video.connectedCallback();
			window.addEventListener = originalAdd;
			return listenerAdded;
		});
		expect(result).toBe(true);
	});
});
