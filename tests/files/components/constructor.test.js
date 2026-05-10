const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseComponent constructor', () => {
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

  test('should initialize rendered property to false when element is created', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      return video.rendered;
    });

    expect(result).toBe(false);
  });

  test('should initialize as HTMLElement', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      return video instanceof HTMLElement;
    });

    expect(result).toBe(true);
  });
});