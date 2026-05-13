const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("helpModal", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("toggleHelp should open modal when overlay is hidden", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui._onRefresh = () => {};
			ui._onReset = () => {};
			ui.helpOverlay.style.display = "none";
			document.getElementById("lesson-frame").style.display = "block";
			ui.isPaused = false;

			ui.toggleHelp();

			return {
				overlayDisplay: ui.helpOverlay.style.display,
				frameDisplay: document.getElementById("lesson-frame").style.display,
				isPaused: ui.isPaused,
				hasButtons: ui.helpContent.innerHTML.includes("Help with Current Page") &&
					ui.helpContent.innerHTML.includes("General Course Help") &&
					ui.helpContent.innerHTML.includes("Refresh This Web Page") &&
					ui.helpContent.innerHTML.includes("Reset Course Progress"),
			};
		});

		expect(result.overlayDisplay).toBe("flex");
		expect(result.frameDisplay).toBe("none");
		expect(result.isPaused).toBe(true);
		expect(result.hasButtons).toBe(true);
	});

	test("toggleHelp should close modal when overlay is already open", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.helpOverlay.style.display = "flex";
			document.getElementById("lesson-frame").style.display = "none";
			ui.isPaused = true;

			ui.toggleHelp();

			return {
				overlayDisplay: ui.helpOverlay.style.display,
				frameDisplay: document.getElementById("lesson-frame").style.display,
				isPaused: ui.isPaused,
			};
		});

		expect(result.overlayDisplay).toBe("none");
		expect(result.frameDisplay).toBe("block");
		expect(result.isPaused).toBe(false);
	});

	test("showHelpMenu should render all 4 buttons and use global callbacks", async () => {
		const result = await page.evaluate(() => {
			try {
				if(!ui.infoBanner) ui.init();
				ui._onRefresh = () => "refreshed";
				ui._onReset = () => "reset";

				ui.showHelpMenu();

				const html = ui.helpContent.innerHTML;
				return {
					ok: true,
					onRefreshType: typeof ui._onRefresh,
					onResetType: typeof ui._onReset,
					hasPageHelp: html.includes("Help with Current Page"),
					hasGeneralHelp: html.includes("General Course Help"),
					hasRefresh: html.includes("Refresh This Web Page"),
					hasReset: html.includes("Reset Course Progress"),
					onRefreshCall: ui._onRefresh ? ui._onRefresh() : null,
					onResetCall: ui._onReset ? ui._onReset() : null,
				};
			} catch(e) {
				return { ok: false, error: e.message, stack: e.stack };
			}
		});

		expect(result.ok).toBe(true);
		expect(result.onRefreshType).toBe("function");
		expect(result.onResetType).toBe("function");
		expect(result.hasPageHelp).toBe(true);
		expect(result.hasGeneralHelp).toBe(true);
		expect(result.hasRefresh).toBe(true);
		expect(result.hasReset).toBe(true);
		expect(result.onRefreshCall).toBe("refreshed");
		expect(result.onResetCall).toBe("reset");
	});

	test("showPageHelp should render completion table with checkmarks", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const page = {
				completionRules: {
					watchTime: 30,
					score: 0.7,
					scrolled: true,
					videoProgress: 0.8,
				},
				maxScore: 100,
				components: [],
			};
			const pageDelta = {
				watchTime: 45,
				score: 85,
				scrolled: true,
				videoProgress: 0.9,
				components: {},
			};

			ui.showPageHelp(page, pageDelta);

			const html = ui.helpContent.innerHTML;
			return {
				hasTitle: html.includes("Page Completion Requirements"),
				hasTimeRow: html.includes("Time on Page"),
				hasScoreRow: html.includes("Minimum Score"),
				hasScrolledRow: html.includes("Read Entire Article"),
				hasVideoRow: html.includes("Watch Video"),
				hasRefreshBtn: html.includes("Refresh Status"),
				hasBackBtn: html.includes("Back to Menu"),
				hasPassIcons: html.includes("status-pass"),
			};
		});

		expect(result.hasTitle).toBe(true);
		expect(result.hasTimeRow).toBe(true);
		expect(result.hasScoreRow).toBe(true);
		expect(result.hasScrolledRow).toBe(true);
		expect(result.hasVideoRow).toBe(true);
		expect(result.hasRefreshBtn).toBe(true);
		expect(result.hasBackBtn).toBe(true);
		expect(result.hasPassIcons).toBe(true);
	});

	test("showPageHelp should show fail icons for unmet requirements", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const page = {
				completionRules: {
					watchTime: 60,
					score: 0.7,
					scrolled: true,
					videoProgress: 0.8,
				},
				maxScore: 100,
				components: [],
			};
			const pageDelta = {
				watchTime: 10,
				score: 30,
				scrolled: false,
				videoProgress: 0.2,
				components: {},
			};

			ui.showPageHelp(page, pageDelta);

			const html = ui.helpContent.innerHTML;
			return {
				hasFailIcons: html.includes("status-fail"),
				timeDisplayed: html.includes("10 seconds"),
				scoreDisplayed: html.includes("30%"),
			};
		});

		expect(result.hasFailIcons).toBe(true);
		expect(result.timeDisplayed).toBe(true);
		expect(result.scoreDisplayed).toBe(true);
	});

	test("showGeneralHelp should render help iframe", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.showGeneralHelp();
			const html = ui.helpContent.innerHTML;
			return {
				hasIframe: html.includes("help.html"),
				hasBackBtn: html.includes("Back to Menu"),
			};
		});

		expect(result.hasIframe).toBe(true);
		expect(result.hasBackBtn).toBe(true);
	});

	test("closeHelp should restore modal state", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const frame = document.getElementById("lesson-frame");
			ui.helpOverlay.style.display = "flex";
			frame.style.display = "none";
			ui.isPaused = true;
			ui.helpContent.innerHTML = "<p>Some content</p>";

			ui.closeHelp(frame);

			return {
				overlayDisplay: ui.helpOverlay.style.display,
				contentEmpty: ui.helpContent.innerHTML === "",
				frameDisplay: frame.style.display,
				isPaused: ui.isPaused,
			};
		});

		expect(result.overlayDisplay).toBe("none");
		expect(result.contentEmpty).toBe(true);
		expect(result.frameDisplay).toBe("block");
		expect(result.isPaused).toBe(false);
	});

	test("closeHelpFrame should query lesson-frame and call closeHelp", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const frame = document.getElementById("lesson-frame");
			ui.helpOverlay.style.display = "flex";
			frame.style.display = "none";
			ui.isPaused = true;
			ui.helpContent.innerHTML = "<p>test</p>";

			ui.closeHelpFrame();

			return {
				overlayDisplay: ui.helpOverlay.style.display,
				contentEmpty: ui.helpContent.innerHTML === "",
				frameDisplay: frame.style.display,
				isPaused: ui.isPaused,
			};
		});

		expect(result.overlayDisplay).toBe("none");
		expect(result.contentEmpty).toBe(true);
		expect(result.frameDisplay).toBe("block");
		expect(result.isPaused).toBe(false);
	});

	test("closeHelp should restore lastActiveElement focus", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const btn = document.createElement("button");
			btn.id = "mock-focus-target";
			document.body.appendChild(btn);
			btn.focus();

			ui.lastActiveElement = btn;
			const frame = document.getElementById("lesson-frame");

			ui.closeHelp(frame);

			const focused = document.activeElement;
			document.body.removeChild(btn);

			return {
				focusRestored: focused === btn,
				lastCleared: ui.lastActiveElement === null,
			};
		});

		expect(result.focusRestored).toBe(true);
		expect(result.lastCleared).toBe(true);
	});

	test("showPageHelp should re-render when called without args (Refresh button)", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const page = {
				completionRules: { watchTime: 10, score: 0.5, scrolled: false, videoProgress: 0 },
				maxScore: 100,
				components: [],
			};
			const pageDelta = {
				watchTime: 20,
				score: 80,
				components: {},
				videoProgress: 0,
			};

			ui.showPageHelp(page, pageDelta);
			const firstRender = ui.helpContent.innerHTML.includes("20 seconds");

			// Simulate Refresh button call (no args)
			ui.showPageHelp();
			const secondRender = ui.helpContent.innerHTML.includes("20 seconds");

			return {
				firstRender,
				secondRender,
			};
		});

		expect(result.firstRender).toBe(true);
		expect(result.secondRender).toBe(true);
	});
});
