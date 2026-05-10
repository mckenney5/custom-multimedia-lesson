const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseVideo formatTime()', () => {
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

  test('should format 0 seconds as 0:00', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element to access the method
      const video = document.createElement('course-video');
      return video.formatTime(0);
    });
    expect(result).toBe('0:00');
  });

  test('should format 5 seconds as 0:05', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element to access the method
      const video = document.createElement('course-video');
      return video.formatTime(5);
    });
    expect(result).toBe('0:05');
  });

  test('should format 60 seconds as 1:00', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element to access the method
      const video = document.createElement('course-video');
      return video.formatTime(60);
    });
    expect(result).toBe('1:00');
  });

  test('should format 65 seconds as 1:05', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element to access the method
      const video = document.createElement('course-video');
      return video.formatTime(65);
    });
    expect(result).toBe('1:05');
  });

  test('should format 3599 seconds as 59:59', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element to access the method
      const video = document.createElement('course-video');
      return video.formatTime(3599);
    });
    expect(result).toBe('59:59');
  });

  test('should format 3600 seconds as 60:00', async () => {
    const result = await page.evaluate(() => {
      // Create a course-video element to access the method
      const video = document.createElement('course-video');
      return video.formatTime(3600);
    });
    expect(result).toBe('60:00');
  });
});