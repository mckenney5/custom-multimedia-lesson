const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseComponent attr() method', () => {
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

  test('should return attribute value when present', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element with a src attribute
      const video = document.createElement('course-video');
      video.setAttribute('src', 'test-video.mp4');
      return video.attr('src');
    });

    expect(result).toBe('test-video.mp4');
  });

  test('should return default value when attribute is not present', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element without a src attribute
      const video = document.createElement('course-video');
      return video.attr('src', 'default-video.mp4');
    });

    expect(result).toBe('default-video.mp4');
  });

  test('should return empty string when attribute is not present and no default provided', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element without a src attribute
      const video = document.createElement('course-video');
      return video.attr('src');
    });

    expect(result).toBe('');
  });
});