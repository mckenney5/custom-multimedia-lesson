const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseVideo observedAttributes()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    // Load components.js for this test
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should return array containing src', async () => {
    const result = await page.evaluate(() => {
      // Access the static observedAttributes getter
      return CourseVideo.observedAttributes;
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('src');
    expect(result.length).toBe(1);
  });
});