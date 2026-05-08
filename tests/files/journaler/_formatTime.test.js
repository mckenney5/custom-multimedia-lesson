const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('_formatTime / getHumanTime', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should convert offset to human readable time format', async () => {
    const result = await page.evaluate(() => {
      // Set a known start time for testing
      journaler._startTime = Date.parse('2023-01-01T12:00:00Z');

      // Test that the function returns a string in the expected format
      const actual = journaler.getHumanTime(0);

      // Check format: MM/DD/YYYY HH:MM:SS
      const regex = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;
      return regex.test(actual);
    });

    expect(result).toBe(true);
  });
});
