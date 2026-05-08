const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('_getOffset', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should calculate time offset correctly', async () => {
    // Mock time to fixed value to eliminate flakiness
    await page.clock.setFixedTime(new Date(1000000)); // 1000s since epoch

    const result = await page.evaluate(() => {
      // Set start time to 5s before fixed time (1000000ms - 5000ms = 995000ms)
      journaler._startTime = 995000;
      const offset = journaler._getOffset();
      return offset === 5; // Exact 5s offset
    });

    expect(result).toBe(true);
  });
});
