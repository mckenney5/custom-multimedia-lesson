const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseComponent handleStudentData()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should exist and be callable', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      return typeof video.handleStudentData === 'function';
    });

    expect(result).toBe(true);
  });

  test('should not produce console output', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      const logMessages = [];
      const originalLog = console.log;
      console.log = function(message) {
        logMessages.push(message);
      };

      const mockEvent = { detail: { name: 'John Doe', grade: 'A' } };
      video.handleStudentData(mockEvent);
      console.log = originalLog;

      return logMessages;
    });

    expect(result.length).toBe(0);
  });

  test('should not produce console output when called', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      const logMessages = [];
      const originalLog = console.log;
      console.log = function(message) {
        logMessages.push(message);
      };

      video.handleStudentData({ detail: { name: 'Test', grade: 'B' } });
      console.log = originalLog;

      return logMessages;
    });

    expect(result.length).toBe(0);
  });

  test('should not crash when event has no detail property', async () => {
    const result = await page.evaluate(() => {
      const video = document.createElement('course-video');
      try {
        video.handleStudentData({});
        return 'no error';
      } catch(e) {
        return e.message;
      }
    });
    expect(result).toBe('no error');
  });
});