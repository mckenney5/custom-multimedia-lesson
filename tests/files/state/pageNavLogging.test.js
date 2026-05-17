const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("state page navigation logging: PAGE_NEXT / PAGE_PREV", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should log PAGE_NEXT when advancePage navigates forward", async () => {
		const result = await page.evaluate(() => {
			const mockPages = [
				{
					name: "page1",
					path: "lessons/page1.html",
					completionRules: { watchTime: 0, score: 0, scrolled: false, videoProgress: 0, requireSubmission: false }
				},
				{
					name: "page2",
					path: "lessons/page2.html",
					completionRules: { watchTime: 0, score: 0, scrolled: false, videoProgress: 0, requireSubmission: false }
				},
			];

			state.data.pages = mockPages;
			state.data.delta.currentPageIndex = 0;
			state.data.delta.pagesState = [
				{ completed: true, watchTime: 0, score: 0, scrolled: false, videoProgress: 0 },
				{ completed: false, watchTime: 0, score: 0, scrolled: false, videoProgress: 0 },
			];
			state.data.delta.progress = 0;
			state.lessonFrame = {
				_src: "",
				get src() { return this._src; },
				set src(v) { this._src = v; }
			};
			ui.infoBanner = document.createElement("div");
			ui.hideBanner = () => {};
			ui.updateInfo = () => {};
			ui._lastPage = null;
			ui._lastPageDelta = null;

			state.next();

			const csv = journaler.report();
			const eventNames = csv.slice(1).map(row => row[2]);
			return {
				hasPageNext: eventNames.some(e => e === "PAGE_NEXT"),
				nextIndex: state.data.delta.currentPageIndex,
			};
		});

		expect(result.hasPageNext).toBe(true);
		expect(result.nextIndex).toBe(1);
	});

	test("should log PAGE_PREV when prev navigates backward", async () => {
		const result = await page.evaluate(() => {
			const mockPages = [
				{ name: "page1", path: "lessons/page1.html" },
				{ name: "page2", path: "lessons/page2.html" },
			];

			state.data.pages = mockPages;
			state.data.delta.currentPageIndex = 1;
			state.data.delta.pagesState = [{ completed: true }, { completed: true }];
			state.data.delta.progress = 1;
			state.lessonFrame = {
				_src: "",
				get src() { return this._src; },
				set src(v) { this._src = v; }
			};
			ui.infoBanner = document.createElement("div");
			ui.hideBanner = () => {};
			ui.updateInfo = () => {};
			ui._lastPage = null;
			ui._lastPageDelta = null;

			state.prev();

			const csv = journaler.report();
			const eventNames = csv.slice(1).map(row => row[2]);
			return {
				hasPagePrev: eventNames.some(e => e === "PAGE_PREV"),
				prevIndex: state.data.delta.currentPageIndex,
			};
		});

		expect(result.hasPagePrev).toBe(true);
		expect(result.prevIndex).toBe(0);
	});
});
