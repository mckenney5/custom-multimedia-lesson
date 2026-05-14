const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("bannerMessage", () => {
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		await setupPage(page);
	});

	test.afterEach(async () => {
		await page.close();
	});

	test("should render error banner with message", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.bannerMessage("Test error message", true);
			return {
				display: ui.infoBanner.style.display,
				className: ui.infoBanner.className,
				text: ui.infoBanner.innerText,
				hasSvg: ui.infoBanner.innerHTML.includes("<svg"),
			};
		});

		expect(result.display).toBe("flex");
		expect(result.className).toBe("error");
		expect(result.text).toContain("Test error message");
		expect(result.hasSvg).toBe(true);
	});

	test("should render warning banner when isError=false", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.bannerMessage("Page complete", false);
			return {
				display: ui.infoBanner.style.display,
				className: ui.infoBanner.className,
				hasSvg: ui.infoBanner.innerHTML.includes("<svg"),
			};
		});

		expect(result.display).toBe("flex");
		expect(result.className).toBe("warning");
		expect(result.hasSvg).toBe(true);
	});

	test("should escape HTML in message", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.bannerMessage("<script>alert('xss')</script>", true);
			return {
				containsRawScript: ui.infoBanner.innerHTML.includes("<script>"),
				containsEscaped: ui.infoBanner.innerHTML.includes("&lt;script&gt;"),
			};
		});

		expect(result.containsRawScript).toBe(false);
		expect(result.containsEscaped).toBe(true);
	});

	test("should escape attribute-breaking payloads", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.bannerMessage('"><img src=x onerror="alert(1)">', true);
			return {
				noRawImgTag: !ui.infoBanner.innerHTML.includes("<img"),
				textVisible: ui.infoBanner.innerText.includes('"><img'),
			};
		});

		expect(result.noRawImgTag).toBe(true);
		expect(result.textVisible).toBe(true);
	});

	test("hideBanner should hide the banner", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.bannerMessage("Shown", true);
			ui.hideBanner();
			return ui.infoBanner.style.display;
		});

		expect(result).toBe("none");
	});

	test("isBannerVisible should return correct state", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			const before = ui.isBannerVisible();
			ui.bannerMessage("Visible now", true);
			const afterShow = ui.isBannerVisible();
			ui.hideBanner();
			const afterHide = ui.isBannerVisible();
			return { before, afterShow, afterHide };
		});

		expect(result.before).toBe(false);
		expect(result.afterShow).toBe(true);
		expect(result.afterHide).toBe(false);
	});

	test("should set role=alert for error and role=status for warning", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.bannerMessage("Error", true);
			const errorRole = ui.infoBanner.querySelector("span").getAttribute("role");
			ui.bannerMessage("Warning", false);
			const warningRole = ui.infoBanner.querySelector("span").getAttribute("role");
			return { errorRole, warningRole };
		});

		expect(result.errorRole).toBe("alert");
		expect(result.warningRole).toBe("status");
	});

	test("should handle empty message gracefully", async () => {
		const result = await page.evaluate(() => {
			if(!ui.infoBanner) ui.init();
			ui.bannerMessage("", true);
			return ui.infoBanner.style.display;
		});

		expect(result).toBe("flex");
	});
});
