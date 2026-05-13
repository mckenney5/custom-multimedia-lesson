const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("settingsModal", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("toggleSettings should open modal when overlay is hidden", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.helpOverlay.style.display = "none";
			document.getElementById("lesson-frame").style.display = "block";
			ui.isPaused = false;

			ui.toggleSettings();

			return {
				overlayDisplay: ui.helpOverlay.style.display,
				frameDisplay: document.getElementById("lesson-frame").style.display,
				isPaused: ui.isPaused,
				hasSelector: ui.helpContent.innerHTML.includes("theme-select"),
			};
		});

		expect(result.overlayDisplay).toBe("flex");
		expect(result.frameDisplay).toBe("none");
		expect(result.isPaused).toBe(true);
		expect(result.hasSelector).toBe(true);
	});

	test("toggleSettings should close modal when overlay is already open", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.helpOverlay.style.display = "flex";
			document.getElementById("lesson-frame").style.display = "none";
			ui.isPaused = true;

			ui.toggleSettings();

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

	test("showSettingsMenu should render theme selector with correct current theme", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			let capturedValue = null;
			const onThemeChange = (value) => { capturedValue = value; };

			ui.showSettingsMenu("dark", {onThemeChange});

			const html = ui.helpContent.innerHTML;
			return {
				hasLabel: html.includes("Color Theme"),
				hasLight: html.includes("Light Mode"),
				hasDark: html.includes("Dark Mode"),
				hasHC: html.includes("High Contrast"),
				darkSelected: html.includes('value="dark" selected'),
				onThemeChangeType: typeof ui._onThemeChange,
			};
		});

		expect(result.hasLabel).toBe(true);
		expect(result.hasLight).toBe(true);
		expect(result.hasDark).toBe(true);
		expect(result.hasHC).toBe(true);
		expect(result.darkSelected).toBe(true);
		expect(result.onThemeChangeType).toBe("function");
	});

	test("onThemeChange callback fires with correct value", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			let capturedValue = null;
			const onThemeChange = (value) => { capturedValue = value; };

			ui.showSettingsMenu("light", {onThemeChange});

			ui._onThemeChange("high-contrast");

			return {
				captured: capturedValue,
			};
		});

		expect(result.captured).toBe("high-contrast");
	});

	test("showSettingsMenu should save lastActiveElement", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const btn = document.createElement("button");
			btn.id = "mock-focus-for-settings";
			document.body.appendChild(btn);
			btn.focus();

			ui.showSettingsMenu("light", {});
			const saved = ui.lastActiveElement;

			document.body.removeChild(btn);

			return {
				savedElement: saved === btn,
			};
		});

		expect(result.savedElement).toBe(true);
	});

	test("closeHelp should close settings modal and restore state", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const frame = document.getElementById("lesson-frame");
			ui.helpOverlay.style.display = "flex";
			frame.style.display = "none";
			ui.isPaused = true;
			ui.helpContent.innerHTML = "<p>settings content</p>";

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
});
