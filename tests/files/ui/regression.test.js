const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("UI regression fixes", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("Bug 1: showPageHelp should render when called without args (from template)", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			// Set up page cache directly (one-way data flow from state)
			const page = {
				completionRules: { watchTime: 10, score: 0.5, scrolled: false, videoProgress: 0 },
				maxScore: 100,
				components: [],
			};
			const pageDelta = {
				watchTime: 15, score: 80, scrolled: true, videoProgress: 0, components: {},
			};
			ui._lastPage = page;
			ui._lastPageDelta = pageDelta;

			try {
				ui.showPageHelp();
				const html = ui.helpContent.innerHTML;
				return {
					ok: true,
					hasTitle: html.includes("Page Completion Requirements"),
					hasTable: html.includes("<table"),
				};
			} catch(e) {
				return { ok: false, error: e.message };
			}
		});

		expect(result.ok).toBe(true);
		expect(result.hasTitle).toBe(true);
		expect(result.hasTable).toBe(true);
	});

	test("Bug 1: showPageHelp should render from cached _lastPage when state is unavailable", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			// First call with data to populate _lastPage
			const page = {
				completionRules: { watchTime: 5, score: 0, scrolled: false, videoProgress: 0 },
				maxScore: 0,
				components: [],
			};
			const pageDelta = { watchTime: 3, score: 0, components: {}, videoProgress: 0 };
			ui.showPageHelp(page, pageDelta);

			// Second call without args — uses _lastPage
			ui.showPageHelp();
			const html = ui.helpContent.innerHTML;
			return {
				ok: true,
				hasTimeRow: html.includes("Time on Page"),
				timeDisplayed: html.includes("3 seconds"),
			};
		});

		expect(result.ok).toBe(true);
		expect(result.hasTimeRow).toBe(true);
		expect(result.timeDisplayed).toBe(true);
	});

	test("Bug 2: _onRefresh should save and reload", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();

			// Set up minimal state so save() doesn't throw
			if(typeof state !== "undefined") {
				if(!state.data) state.data = {};
				state.data.delta = state.data.delta || {};
				state.data.delta.pagesState = state.data.delta.pagesState || [{
					completed: false, scrolled: false, score: 0, watchTime: 0,
					attempts: 0, videoProgress: 0, userAnswers: [],
				}];
				state.data.delta.currentPageIndex = 0;
				state.data.delta.progress = 0;
				state.data.delta.totalCourseSeconds = 0;
				state.data.pages = state.data.pages || [{ path: "lessons/blank" }];
			}

			const fn = ui._onRefresh;
			const fnStr = fn ? fn.toString() : "";

			return {
				onRefreshType: typeof ui._onRefresh,
				callsSave: fnStr.includes("this.save") || fnStr.includes("save("),
				callsReload: fnStr.includes("location.reload") || fnStr.includes("location.reload()"),
				fnSnippet: fnStr.substring(0, 200),
			};
		});

		expect(result.onRefreshType).toBe("function");
		expect(result.callsReload).toBe(true);
		expect(result.callsSave).toBe(true);
	});

	test("Bug 3: showEndScreen should use real print callback", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			let printCalled = false;
			const originalPrint = ui.printCertificate;
			ui.printCertificate = () => { printCalled = true; };

			// Simulate what state.handleLastPage does
			ui.showEndScreen(true, "85", "70", {
				onQuit: () => {},
				onPrint: () => ui.printCertificate(),
				printData: {
					studentName: "Test",
					overallGrade: { ratio: 0.85 },
					totalSeconds: 100,
					certConfig: { enabled: true },
					minimumMinutes: 10,
				},
			});

			// Call what the template button triggers
			if(ui._onPrint) ui._onPrint();

			ui.printCertificate = originalPrint;

			return {
				onPrintType: typeof ui._onPrint,
				printCalled,
			};
		});

		expect(result.onPrintType).toBe("function");
		expect(result.printCalled).toBe(true);
	});
});
