const { test, expect } = require("@playwright/test");
const { setupPage } = require("../../helpers/page-setup.js");

test.describe("Programming editor syntax highlighting theme support", () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    // Navigate to programming page (index 3)
    await page.evaluate(() => {
      state.data.delta.currentPageIndex = 3;
      state.lessonFrame.src = state.data.pages[3].path;
    });
    await page.waitForFunction(() => {
      const iframe = document.getElementById("lesson-frame");
      return iframe.contentWindow.document.querySelector(".CodeMirror");
    }, { timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("syntax highlighting colors change with theme", async () => {
    const iframe = page.frameLocator("#lesson-frame");

    // Type code with keywords, strings, comments
    await iframe.locator(".CodeMirror-code").first().click();
    await page.keyboard.type('function greet() { return "Hello"; } // comment');
    await page.waitForTimeout(300);

    // Helper to get computed color of a token
    const getTokenColor = async (selector) => {
      return await iframe.locator(selector).first().evaluate(el => 
        window.getComputedStyle(el).color
      );
    };

    // --- Light theme (default) ---
    const lightKeyword = await getTokenColor(".cm-keyword");
    const lightString = await getTokenColor(".cm-string");
    const lightComment = await getTokenColor(".cm-comment");

    // --- Switch to dark theme ---
    await page.locator("#settings-btn").click();
    await page.locator("#theme-select").selectOption("dark");
    await page.locator("#close-help").click();
    await page.waitForTimeout(500); // Wait for theme propagation to iframe

    const darkKeyword = await getTokenColor(".cm-keyword");
    const darkString = await getTokenColor(".cm-string");
    const darkComment = await getTokenColor(".cm-comment");

    // --- Switch to high-contrast theme ---
    await page.locator("#settings-btn").click();
    await page.locator("#theme-select").selectOption("high-contrast");
    await page.locator("#close-help").click();
    await page.waitForTimeout(500);

    const hcKeyword = await getTokenColor(".cm-keyword");
    const hcString = await getTokenColor(".cm-string");
    const hcComment = await getTokenColor(".cm-comment");

    // Verify colors actually differ between themes
    // (exact values depend on CSS variables, but they must change)
    expect(lightKeyword).not.toBe(darkKeyword);
    expect(lightString).not.toBe(darkString);
    expect(lightComment).not.toBe(darkComment);

    expect(darkKeyword).not.toBe(hcKeyword);
    expect(darkString).not.toBe(hcString);
    expect(darkComment).not.toBe(hcComment);

    // Verify light and high-contrast also differ
    expect(lightKeyword).not.toBe(hcKeyword);
    expect(lightString).not.toBe(hcString);
    expect(lightComment).not.toBe(hcComment);
  });
});